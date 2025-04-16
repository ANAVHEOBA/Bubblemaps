import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D } from 'canvas';
import * as d3 from 'd3';
import { SimulationNodeDatum } from 'd3';
import { BubbleMapData, BubbleMapOptions, BubbleMapNode, BubbleMapLink, GeneratedBubbleMap } from '../types';
import path from 'path';
import crypto from 'crypto';

export class BubbleMapGenerator {
  private static instance: BubbleMapGenerator;
  private defaultOptions: BubbleMapOptions = {
    width: 1200,
    height: 800,
    minNodeSize: 10,
    maxNodeSize: 50,
    minLinkWidth: 1,
    maxLinkWidth: 8,
    colors: {
      contract: '#ff4444',
      wallet: '#4444ff',
      burn: '#000000',
      cex: '#44ff44',
      link: '#999999'
    },
    fontFamily: 'Arial',
    backgroundColor: '#ffffff'
  };

  private constructor() {
    // No font initialization needed for now, using system fonts
  }

  public static getInstance(): BubbleMapGenerator {
    if (!BubbleMapGenerator.instance) {
      BubbleMapGenerator.instance = new BubbleMapGenerator();
    }
    return BubbleMapGenerator.instance;
  }

  public async generateBubbleMap(data: BubbleMapData, options: Partial<BubbleMapOptions> = {}): Promise<GeneratedBubbleMap> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const canvas = createCanvas(mergedOptions.width, mergedOptions.height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    // Set background
    ctx.fillStyle = mergedOptions.backgroundColor;
    ctx.fillRect(0, 0, mergedOptions.width, mergedOptions.height);

    // Create force simulation
    const simulation = d3.forceSimulation<BubbleMapNode>(data.nodes)
      .force('link', d3.forceLink<BubbleMapNode, BubbleMapLink>(data.links)
        .id((d: BubbleMapNode) => d.address)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(mergedOptions.width / 2, mergedOptions.height / 2))
      .force('collision', d3.forceCollide().radius((node: SimulationNodeDatum) => {
        const bubbleNode = node as BubbleMapNode;
        return this.calculateNodeRadius(bubbleNode, mergedOptions) + 5;
      }));

    // Run simulation
    for (let i = 0; i < 300; ++i) simulation.tick();

    // Draw links
    this.drawLinks(ctx, data.links, mergedOptions);

    // Draw nodes
    this.drawNodes(ctx, data.nodes, mergedOptions);

    // Add legend
    this.drawLegend(ctx, mergedOptions);

    // Add token info
    this.drawTokenInfo(ctx, data, mergedOptions);

    // Generate cache key
    const cacheKey = this.generateCacheKey(data);

    // Return buffer
    return {
      buffer: canvas.toBuffer('image/png'),
      mimeType: 'image/png',
      cacheKey
    };
  }

  private calculateNodeRadius(node: BubbleMapNode, options: BubbleMapOptions): number {
    const scale = d3.scaleLinear()
      .domain([0, 100]) // percentage scale
      .range([options.minNodeSize, options.maxNodeSize]);
    return scale(node.percentage);
  }

  private calculateLinkWidth(link: BubbleMapLink, options: BubbleMapOptions): number {
    const totalFlow = link.forward + link.backward;
    const scale = d3.scaleLinear()
      .domain([0, 1000]) // Adjust based on your data
      .range([options.minLinkWidth, options.maxLinkWidth]);
    return scale(totalFlow);
  }

  private getNodeColor(node: BubbleMapNode, options: BubbleMapOptions): string {
    if (node.address.toLowerCase() === '0x000000000000000000000000000000000000dead') {
      return options.colors.burn;
    }
    if (node.is_contract) {
      return options.colors.contract;
    }
    // Add CEX detection logic here
    return options.colors.wallet;
  }

  private drawNodes(ctx: CanvasRenderingContext2D, nodes: BubbleMapNode[], options: BubbleMapOptions) {
    nodes.forEach(node => {
      const radius = this.calculateNodeRadius(node, options);
      
      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
      ctx.fillStyle = this.getNodeColor(node, options);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      ctx.font = `12px ${options.fontFamily}`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      const label = node.name || `${node.address.slice(0, 6)}...${node.address.slice(-4)}`;
      ctx.fillText(label, node.x!, node.y! + radius + 15);
    });
  }

  private drawLinks(ctx: CanvasRenderingContext2D, links: BubbleMapLink[], options: BubbleMapOptions) {
    links.forEach(link => {
      const source = link.source as BubbleMapNode;
      const target = link.target as BubbleMapNode;
      const width = this.calculateLinkWidth(link, options);

      // Draw line
      ctx.beginPath();
      ctx.moveTo(source.x!, source.y!);
      ctx.lineTo(target.x!, target.y!);
      ctx.strokeStyle = options.colors.link;
      ctx.lineWidth = width;
      ctx.stroke();

      // Draw arrows if flow is significant
      if (link.forward > 0) {
        this.drawArrow(ctx, source, target, options.colors.link);
      }
      if (link.backward > 0) {
        this.drawArrow(ctx, target, source, options.colors.link);
      }
    });
  }

  private drawArrow(ctx: CanvasRenderingContext2D, from: BubbleMapNode, to: BubbleMapNode, color: string) {
    const angle = Math.atan2(to.y! - from.y!, to.x! - from.x!);
    const radius = this.calculateNodeRadius(to, this.defaultOptions);
    
    // Calculate arrow position (near the target node)
    const x = to.x! - (radius + 15) * Math.cos(angle);
    const y = to.y! - (radius + 15) * Math.sin(angle);

    // Draw arrow
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, 5);
    ctx.lineTo(-10, -5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  private drawLegend(ctx: CanvasRenderingContext2D, options: BubbleMapOptions) {
    const legendItems = [
      { color: options.colors.contract, label: 'Contract' },
      { color: options.colors.wallet, label: 'Wallet' },
      { color: options.colors.burn, label: 'Burn Address' },
      { color: options.colors.cex, label: 'CEX' }
    ];

    const startX = 20;
    const startY = options.height - 100;
    const itemHeight = 25;

    ctx.font = `14px ${options.fontFamily}`;
    ctx.textAlign = 'left';

    legendItems.forEach((item, i) => {
      const y = startY + i * itemHeight;
      
      // Draw color box
      ctx.fillStyle = item.color;
      ctx.fillRect(startX, y, 15, 15);
      
      // Draw label
      ctx.fillStyle = '#000000';
      ctx.fillText(item.label, startX + 25, y + 12);
    });
  }

  private drawTokenInfo(ctx: CanvasRenderingContext2D, data: BubbleMapData, options: BubbleMapOptions) {
    ctx.font = `bold 16px ${options.fontFamily}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    
    const info = [
      `${data.full_name} (${data.symbol})`,
      `Chain: ${data.chain.toUpperCase()}`,
      `Address: ${data.token_address}`,
      `Updated: ${new Date(data.dt_update).toLocaleString()}`
    ];

    info.forEach((text, i) => {
      ctx.fillText(text, 20, 30 + i * 25);
    });
  }

  private generateCacheKey(data: BubbleMapData): string {
    const hash = crypto.createHash('md5');
    hash.update(`${data.token_address}-${data.chain}-${data.dt_update}`);
    return hash.digest('hex');
  }
} 