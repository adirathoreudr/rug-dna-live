// ============================================================
// RUG DNA — Behavioral Graph Builder (Phase 2)
// ============================================================

import type {
  Project, Wallet, NormalizedEvent, GraphNode, GraphEdge,
  NodeType, EdgeType
} from '@/types';
import { nanoid } from './utils';

export interface GraphInput {
  project: Project;
  wallets: Wallet[];
  events: NormalizedEvent[];
  deployerAddress: string;
}

export interface WalletCluster {
  id: string;
  wallets: string[];
  fundingSource?: string;
  riskScore: number;
  label: string;
}

export function buildGraph(input: GraphInput): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: WalletCluster[];
} {
  const nodes: Map<string, GraphNode> = new Map();
  const edges: Map<string, GraphEdge> = new Map();

  // Helper to upsert a node
  function upsertNode(
    address: string,
    type: NodeType,
    label: string,
    riskScore = 0,
    metadata: Record<string, unknown> = {}
  ): GraphNode {
    const id = `${input.project.id}:${address}`;
    const existing = nodes.get(id);
    if (existing) {
      existing.riskScore = Math.max(existing.riskScore, riskScore);
      return existing;
    }
    const node: GraphNode = {
      id,
      projectId: input.project.id,
      nodeType: type,
      address,
      label,
      riskScore,
      metadata,
    };
    nodes.set(id, node);
    return node;
  }

  function upsertEdge(
    sourceAddress: string,
    targetAddress: string,
    type: EdgeType,
    weight = 1,
    timestamp = Date.now(),
    txHash?: string,
    metadata: Record<string, unknown> = {}
  ): void {
    const sourceId = `${input.project.id}:${sourceAddress}`;
    const targetId = `${input.project.id}:${targetAddress}`;
    const edgeId = `${sourceId}->${targetId}:${type}`;

    const existing = edges.get(edgeId);
    if (existing) {
      existing.weight += 1;
      return;
    }

    edges.set(edgeId, {
      id: edgeId,
      projectId: input.project.id,
      sourceId,
      targetId,
      edgeType: type,
      weight,
      timestamp,
      txHash,
      metadata,
    });
  }

  // 1. Deployer node
  upsertNode(
    input.deployerAddress,
    'wallet',
    `Deployer: ${truncAddr(input.deployerAddress)}`,
    50,
    { role: 'deployer', isDeployer: true }
  );

  // 2. Token node
  upsertNode(
    input.project.tokenAddress,
    'token',
    `$${input.project.tokenSymbol}`,
    0,
    { symbol: input.project.tokenSymbol, name: input.project.tokenName }
  );

  // 3. Deployer → Token (created)
  upsertEdge(
    input.deployerAddress,
    input.project.tokenAddress,
    'created_pair',
    1,
    input.project.createdAt
  );

  // 4. Pair node
  if (input.project.pairAddress) {
    upsertNode(
      input.project.pairAddress,
      'pair',
      `${input.project.tokenSymbol}/ETH Pair`,
      0,
      { dex: 'uniswap_v3' }
    );
    upsertEdge(
      input.project.tokenAddress,
      input.project.pairAddress,
      'created_pair',
      1,
      input.project.createdAt
    );
  }

  // 5. Process events
  for (const event of input.events) {
    switch (event.eventType) {
      case 'token_transfer': {
        if (event.fromAddress) {
          upsertNode(event.fromAddress, 'wallet', truncAddr(event.fromAddress), 0);
        }
        if (event.toAddress) {
          upsertNode(event.toAddress, 'wallet', truncAddr(event.toAddress), 0);
        }
        if (event.fromAddress && event.toAddress) {
          upsertEdge(
            event.fromAddress,
            event.toAddress,
            'transferred_to',
            1,
            event.timestamp,
            event.txHash,
            { amount: event.amount, amountUsd: event.amountUsd }
          );
        }
        break;
      }
      case 'swap': {
        const swapper = event.fromAddress;
        if (swapper) {
          upsertNode(swapper, 'wallet', truncAddr(swapper), 0);
          if (input.project.pairAddress) {
            upsertEdge(swapper, input.project.pairAddress, 'swapped_on', 1, event.timestamp, event.txHash);
          }
        }
        break;
      }
      case 'liquidity_add':
      case 'liquidity_remove': {
        const liqProvider = event.fromAddress;
        if (liqProvider) {
          upsertNode(liqProvider, 'liquidity_event', `LP: ${truncAddr(liqProvider)}`, 0, {
            type: event.eventType,
          });
          if (input.project.pairAddress) {
            upsertEdge(
              liqProvider,
              input.project.pairAddress,
              'interacted_with',
              event.eventType === 'liquidity_remove' ? 3 : 1,
              event.timestamp,
              event.txHash
            );
          }
        }
        break;
      }
      case 'wallet_funded': {
        if (event.fromAddress && event.toAddress) {
          upsertNode(event.fromAddress, 'wallet', truncAddr(event.fromAddress), 20, { isFunder: true });
          upsertNode(event.toAddress, 'wallet', truncAddr(event.toAddress), 0);
          upsertEdge(
            event.fromAddress,
            event.toAddress,
            'funded_by',
            2,
            event.timestamp,
            event.txHash
          );
        }
        break;
      }
    }
  }

  // 6. Process wallets — mark suspicious, assign clusters
  const clusters = detectWalletClusters(input.wallets, input.events, input.project.id);

  for (const wallet of input.wallets) {
    const nodeId = `${input.project.id}:${wallet.address}`;
    const existingNode = nodes.get(nodeId);
    if (existingNode) {
      existingNode.riskScore = wallet.isSuspicious ? 70 : existingNode.riskScore;
      existingNode.clusterId = wallet.clusterId;
      existingNode.metadata = {
        ...existingNode.metadata,
        isSuspicious: wallet.isSuspicious,
        labels: wallet.labels,
        clusterId: wallet.clusterId,
      };
    }
  }

  // 7. Apply force-directed layout hints
  applyLayoutHints(nodes, input.project.tokenAddress, input.deployerAddress);

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    clusters,
  };
}

function detectWalletClusters(
  wallets: Wallet[],
  events: NormalizedEvent[],
  projectId: string
): WalletCluster[] {
  const clusters: WalletCluster[] = [];

  // Group by funding source
  const fundingGroups = new Map<string, Wallet[]>();
  for (const w of wallets) {
    if (w.fundingSource) {
      const group = fundingGroups.get(w.fundingSource) ?? [];
      group.push(w);
      fundingGroups.set(w.fundingSource, group);
    }
  }

  for (const [source, members] of fundingGroups) {
    if (members.length >= 2) {
      const riskScore = Math.min(90, 40 + members.length * 8);
      clusters.push({
        id: `cluster-${source.slice(0, 8)}`,
        wallets: members.map(w => w.address),
        fundingSource: source,
        riskScore,
        label: `Cluster: ${members.length} wallets, same funder`,
      });

      // Mark wallets as suspicious
      for (const w of members) {
        w.isSuspicious = true;
        w.clusterId = `cluster-${source.slice(0, 8)}`;
      }
    }
  }

  return clusters;
}

function applyLayoutHints(
  nodes: Map<string, GraphNode>,
  tokenAddress: string,
  deployerAddress: string
) {
  const nodeArray = Array.from(nodes.values());
  const centerX = 600;
  const centerY = 230;
  const radius = 180;

  // Token at center
  const tokenNode = nodeArray.find(n => n.address === tokenAddress);
  if (tokenNode) { tokenNode.x = centerX; tokenNode.y = centerY; }

  // Deployer at left
  const deployerNode = nodeArray.find(n => n.address === deployerAddress);
  if (deployerNode) { deployerNode.x = centerX - 350; deployerNode.y = centerY; }

  // Others in circle
  const others = nodeArray.filter(n =>
    n.address !== tokenAddress && n.address !== deployerAddress
  );

  others.forEach((node, i) => {
    const angle = (i / others.length) * 2 * Math.PI;
    const r = node.nodeType === 'liquidity_event' ? radius * 0.6 : radius;
    node.x = centerX + Math.cos(angle) * r + (Math.random() - 0.5) * 40;
    node.y = centerY + Math.sin(angle) * r + (Math.random() - 0.5) * 40;
  });
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
