// ═══════════════════════════════════════════════════════════════════
// charEdge — Decision Tree Journal (Task 4.3.16)
//
// Pre-trade forced-choice classification system.
// Guides traders through: Setup Type → Conviction → R:R → Timeframe
// before entering a trade. Outputs classification tags.
//
// Usage:
//   const tree = new DecisionTreeJournal();
//   tree.start();
//   tree.selectChoice(0); // Select first option
//   tree.selectChoice(1); // Next level
//   const result = tree.getResult();
//   // → { classifications: ['breakout', 'high', '2:1', 'intraday'], tags: [...] }
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface TreeChoice {
    label: string;
    value: string;
    emoji?: string;
    description?: string;
}

export interface TreeNode {
    id: string;
    question: string;
    description?: string;
    choices: TreeChoice[];
    /** Next node ID after selection, or null if terminal */
    nextNodeId?: string;
}

export interface TreeResult {
    classifications: string[];
    tags: string[];
    selections: Array<{ nodeId: string; question: string; choice: TreeChoice }>;
    completedAt: number;
}

export interface DecisionTreeConfig {
    id: string;
    name: string;
    nodes: TreeNode[];
    /** Order of node IDs in the tree */
    nodeOrder: string[];
}

// ─── Default Tree ──────────────────────────────────────────────────

const DEFAULT_TREE: DecisionTreeConfig = {
    id: 'default',
    name: 'Pre-Trade Classification',
    nodeOrder: ['setup', 'conviction', 'rr', 'timeframe'],
    nodes: [
        {
            id: 'setup',
            question: 'What type of setup is this?',
            description: 'Classify the primary pattern or catalyst',
            choices: [
                { label: 'Breakout', value: 'breakout', emoji: '🚀', description: 'Price breaking key level' },
                { label: 'Pullback', value: 'pullback', emoji: '↩️', description: 'Retracement to support' },
                { label: 'Reversal', value: 'reversal', emoji: '🔄', description: 'Trend change signal' },
                { label: 'Range Play', value: 'range', emoji: '📊', description: 'Bounce within range' },
                { label: 'Momentum', value: 'momentum', emoji: '⚡', description: 'Following strong move' },
                { label: 'News/Catalyst', value: 'catalyst', emoji: '📰', description: 'Event-driven' },
            ],
        },
        {
            id: 'conviction',
            question: 'How confident are you?',
            description: 'Honest self-assessment before entry',
            choices: [
                { label: 'A+ Setup', value: 'high', emoji: '🎯', description: 'Everything aligns perfectly' },
                { label: 'Solid', value: 'medium', emoji: '✅', description: 'Good setup, some uncertainty' },
                { label: 'Speculative', value: 'low', emoji: '🎲', description: 'Taking a shot, lower conviction' },
            ],
        },
        {
            id: 'rr',
            question: 'What\'s your risk-to-reward?',
            description: 'Target R:R for this trade',
            choices: [
                { label: '1:1', value: '1:1', emoji: '1️⃣' },
                { label: '2:1', value: '2:1', emoji: '2️⃣' },
                { label: '3:1+', value: '3:1+', emoji: '3️⃣', description: 'High R:R swing' },
                { label: 'Scalp (<1:1)', value: 'scalp', emoji: '⚡', description: 'Quick in/out' },
            ],
        },
        {
            id: 'timeframe',
            question: 'Expected holding time?',
            description: 'How long do you plan to hold?',
            choices: [
                { label: 'Scalp (<5m)', value: 'scalp', emoji: '⚡' },
                { label: 'Intraday', value: 'intraday', emoji: '☀️', description: 'Close by EOD' },
                { label: 'Swing (2-5d)', value: 'swing', emoji: '🌊' },
                { label: 'Position (1w+)', value: 'position', emoji: '🏔️' },
            ],
        },
    ],
};

// ─── Engine ─────────────────────────────────────────────────────

export class DecisionTreeJournal {
    private _config: DecisionTreeConfig;
    private _currentNodeIndex = -1;
    private _selections: Array<{ nodeId: string; question: string; choice: TreeChoice }> = [];
    private _active = false;
    private _customTrees: Map<string, DecisionTreeConfig> = new Map();

    constructor(config?: DecisionTreeConfig) {
        this._config = config || DEFAULT_TREE;
    }

    // ─── Navigation ─────────────────────────────────────────────────

    /**
     * Start the decision tree from the first node.
     */
    start(): TreeNode | null {
        this._active = true;
        this._currentNodeIndex = 0;
        this._selections = [];
        return this.getCurrentNode();
    }

    /**
     * Get the current node.
     */
    getCurrentNode(): TreeNode | null {
        if (!this._active || this._currentNodeIndex < 0) return null;
        if (this._currentNodeIndex >= this._config.nodeOrder.length) return null;

        const nodeId = this._config.nodeOrder[this._currentNodeIndex];
        return this._config.nodes.find((n) => n.id === nodeId) || null;
    }

    /**
     * Select a choice at the current node and advance to the next.
     * Returns the next node, or null if the tree is complete.
     */
    selectChoice(choiceIndex: number): TreeNode | null {
        const node = this.getCurrentNode();
        if (!node) return null;

        if (choiceIndex < 0 || choiceIndex >= node.choices.length) return null;

        const choice = node.choices[choiceIndex];
        this._selections.push({
            nodeId: node.id,
            question: node.question,
            choice,
        });

        this._currentNodeIndex++;

        if (this._currentNodeIndex >= this._config.nodeOrder.length) {
            // Tree complete
            return null;
        }

        return this.getCurrentNode();
    }

    /**
     * Skip the current node and advance.
     */
    skip(): TreeNode | null {
        if (!this._active) return null;
        this._currentNodeIndex++;
        if (this._currentNodeIndex >= this._config.nodeOrder.length) return null;
        return this.getCurrentNode();
    }

    /**
     * Go back one step.
     */
    goBack(): TreeNode | null {
        if (!this._active || this._currentNodeIndex <= 0) return null;
        this._currentNodeIndex--;
        // Remove the selection for this node
        const nodeId = this._config.nodeOrder[this._currentNodeIndex];
        this._selections = this._selections.filter((s) => s.nodeId !== nodeId);
        return this.getCurrentNode();
    }

    // ─── Result ─────────────────────────────────────────────────────

    /**
     * Check if the tree is complete.
     */
    isComplete(): boolean {
        return this._active && this._currentNodeIndex >= this._config.nodeOrder.length;
    }

    /**
     * Get the progress (0 to 1).
     */
    getProgress(): number {
        if (!this._active) return 0;
        return Math.min(this._currentNodeIndex / this._config.nodeOrder.length, 1);
    }

    /**
     * Get the number of steps completed.
     */
    getStepInfo(): { current: number; total: number } {
        return {
            current: Math.min(this._currentNodeIndex + 1, this._config.nodeOrder.length),
            total: this._config.nodeOrder.length,
        };
    }

    /**
     * Get the final result after completing the tree.
     * Can also be called mid-tree for partial results.
     */
    getResult(): TreeResult {
        const classifications = this._selections.map((s) => s.choice.value);
        const tags = this._selections.map((s) => `${s.nodeId}:${s.choice.value}`);

        return {
            classifications,
            tags,
            selections: [...this._selections],
            completedAt: Date.now(),
        };
    }

    /**
     * Reset the tree.
     */
    reset(): void {
        this._currentNodeIndex = -1;
        this._selections = [];
        this._active = false;
    }

    // ─── Custom Trees ───────────────────────────────────────────────

    /**
     * Add a custom node to the current tree.
     */
    addNode(node: TreeNode, position?: number): void {
        const idx = position ?? this._config.nodes.length;
        this._config.nodes.splice(idx, 0, node);
        const orderIdx = position ?? this._config.nodeOrder.length;
        this._config.nodeOrder.splice(orderIdx, 0, node.id);
    }

    /**
     * Remove a node from the tree.
     */
    removeNode(nodeId: string): void {
        this._config.nodes = this._config.nodes.filter((n) => n.id !== nodeId);
        this._config.nodeOrder = this._config.nodeOrder.filter((id) => id !== nodeId);
    }

    /**
     * Save a custom tree configuration.
     */
    saveCustomTree(config: DecisionTreeConfig): void {
        this._customTrees.set(config.id, config);
        try {
            const stored = JSON.parse(localStorage.getItem('charEdge-decision-trees') || '{}');
            stored[config.id] = config;
            localStorage.setItem('charEdge-decision-trees', JSON.stringify(stored));
        } catch {
            // Storage is best-effort
        }
    }

    /**
     * Load a custom tree configuration.
     */
    loadCustomTree(id: string): DecisionTreeConfig | null {
        if (this._customTrees.has(id)) return this._customTrees.get(id)!;
        try {
            const stored = JSON.parse(localStorage.getItem('charEdge-decision-trees') || '{}');
            return stored[id] || null;
        } catch {
            return null;
        }
    }

    /**
     * Switch to a different tree configuration.
     */
    useTree(config: DecisionTreeConfig): void {
        this._config = config;
        this.reset();
    }

    /**
     * Get the default tree configuration.
     */
    static getDefaultTree(): DecisionTreeConfig {
        return { ...DEFAULT_TREE, nodes: DEFAULT_TREE.nodes.map((n) => ({ ...n, choices: [...n.choices] })) };
    }
}

// ─── Singleton ───────────────────────────────────────────────────

export const decisionTreeJournal = new DecisionTreeJournal();
export default decisionTreeJournal;
