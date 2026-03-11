// ═══════════════════════════════════════════════════════════════════
// useTradeForm — form state, validation, submission, and effects
// Extracted from TradeFormModal.jsx for single-responsibility.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { roundField } from '../../../../charting_library/model/Money.js';
import { useJournalStore } from '../../../../state/useJournalStore';
import { useTradeTemplateStore, applyTradeTemplate } from '../../../../state/useTradeTemplateStore.js';
import { uid } from '../../../../utils.js';
import toast from '../../ui/Toast.jsx';
import { calculatePnL } from './PnLCalculator.js';
import { processScreenshot } from './ScreenshotProcessor.js';
import { EMPTY_FORM } from './tradeConstants.js';

/**
 * Custom hook encapsulating all TradeFormModal state and logic.
 * @param {{ isOpen: boolean, onClose: Function, editTrade: object|null }} options
 * @returns {object} Form state, setters, handlers, refs, and template state
 */
export function useTradeForm({ isOpen, onClose, editTrade }) {
    const addTrade = useJournalStore((s) => s.addTrade);
    const updateTrade = useJournalStore((s) => s.updateTrade);
    const playbooks = useJournalStore((s) => s.playbooks);
    const tradeTemplates = useTradeTemplateStore((s) => s.templates);

    const isEdit = !!editTrade;
    const symbolRef = useRef(null);

    // Sprint 9: Template + checklist state
    const [activeTemplateId, setActiveTemplateId] = useState(null);
    const [checklistState, setChecklistState] = useState({});
    // Sprint 11: Progressive disclosure
    const [showDetails, setShowDetails] = useState(false);
    // Sprint 3: Post-trade review
    const [reviewTrade, setReviewTrade] = useState(null);
    const [reviewOpen, setReviewOpen] = useState(false);

    // ─── Form State ───────────────────────────────────────────
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [isDragging, setIsDragging] = useState(false);

    // Populate form when editing
    useEffect(() => {
        if (isEdit && editTrade) {
            setForm({
                symbol: editTrade.symbol || '',
                side: editTrade.side || 'long',
                assetClass: editTrade.assetClass || 'futures',
                qty: editTrade.qty ?? '',
                entry: editTrade.entry ?? '',
                exit: editTrade.exit ?? '',
                pnl: editTrade.pnl ?? '',
                fees: editTrade.fees ?? '',
                date: editTrade.date ? editTrade.date.slice(0, 16) : '',
                closeDate: editTrade.closeDate ? editTrade.closeDate.slice(0, 16) : '',
                emotion: editTrade.emotion || '',
                playbook: editTrade.playbook || '',
                rMultiple: editTrade.rMultiple ?? '',
                tags: Array.isArray(editTrade.tags) ? editTrade.tags.join(', ') : '',
                notes: editTrade.notes || '',
                ruleBreak: editTrade.ruleBreak || false,
                screenshots: editTrade.screenshots || [],
            });
        } else {
            setForm(EMPTY_FORM);
        }
        setErrors({});
        // Sprint 11: Auto-expand details when editing
        setShowDetails(isEdit);
         
    }, [editTrade, isOpen, isEdit]);

    // Focus symbol on open
    useEffect(() => {
        if (isOpen && symbolRef.current) {
            setTimeout(() => symbolRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Clipboard paste handler for screenshots
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) processScreenshot(file, form, (field, val) => setForm((f) => ({ ...f, [field]: val })));
                    break;
                }
            }
        };
        window.addEventListener('paste', handler);
        return () => window.removeEventListener('paste', handler);
    }, [isOpen, form]);

    // ─── Field setter ─────────────────────────────────────────
    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    // ─── Drag handlers ────────────────────────────────────────
    const handleDragOver = (e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!isOpen) return;
        const files = e.dataTransfer?.files;
        if (!files) return;
        Array.from(files).forEach((file) => {
            if (file.type.startsWith('image/')) {
                processScreenshot(file, form, (field, val) => setForm((f) => ({ ...f, [field]: val })));
            }
        });
    };

    // ─── Validation ───────────────────────────────────────────
    function validate() {
        const e = {};
        if (!form.symbol.trim()) e.symbol = 'Required';
        if (form.pnl === '' || isNaN(Number(form.pnl))) e.pnl = 'Required';
        if (!form.date) e.date = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    // ─── Submit ───────────────────────────────────────────────
    function handleSubmit() {
        if (!validate()) return;

        const trade = {
            id: isEdit ? editTrade.id : uid(),
            symbol: form.symbol.trim().toUpperCase(),
            side: form.side,
            assetClass: form.assetClass,
            qty: form.qty !== '' ? roundField(Number(form.qty), 'qty', form.assetClass) : null,
            entry: form.entry !== '' ? roundField(Number(form.entry), 'entry', form.assetClass) : null,
            exit: form.exit !== '' ? roundField(Number(form.exit), 'exit', form.assetClass) : null,
            pnl: roundField(Number(form.pnl), 'pnl', form.assetClass),
            fees: form.fees !== '' ? roundField(Number(form.fees), 'fees', form.assetClass) : 0,
            date: new Date(form.date).toISOString(),
            closeDate: form.closeDate ? new Date(form.closeDate).toISOString() : null,
            emotion: form.emotion,
            playbook: form.playbook,
            rMultiple: form.rMultiple !== '' ? Number(form.rMultiple) : null,
            tags: form.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            notes: form.notes.trim(),
            ruleBreak: form.ruleBreak,
            screenshots: form.screenshots || [],
            // Sprint 9: template + checklist data
            templateId: activeTemplateId || null,
            checklist: activeTemplateId ? { ...checklistState } : null,
            _moneyV: 1,
        };

        if (isEdit) {
            updateTrade(trade.id, trade);
            toast.success(`${trade.symbol} trade updated`);
            onClose();
        } else {
            addTrade(trade);
            toast.success(`${trade.symbol} ${trade.side} trade added — ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`);
            // Sprint 3: Open post-trade review for new trades
            onClose();
            setReviewTrade(trade);
            setReviewOpen(true);
        }

        setActiveTemplateId(null);
        setChecklistState({});
    }

    // ─── Auto-calculate P&L from entry/exit/qty/side ──────────
    function autoCalcPnl() {
        const pnl = calculatePnL(form);
        if (pnl !== null) set('pnl', pnl);
    }

    // ─── Template selection handler ───────────────────────────
    function handleTemplateSelect(tpl) {
        if (activeTemplateId === tpl.id) {
            setActiveTemplateId(null);
            setChecklistState({});
        } else {
            setActiveTemplateId(tpl.id);
            const fields = applyTradeTemplate(tpl);
            Object.entries(fields).forEach(([k, v]) => set(k, v));
            // Reset checklist
            const initChecklist = {};
            (tpl.checklist || []).forEach((item) => {
                initChecklist[item.id] = false;
            });
            setChecklistState(initChecklist);
        }
    }

    return {
        // State
        form, errors, isDragging, isEdit,
        showDetails, setShowDetails,
        reviewTrade, reviewOpen, setReviewOpen, setReviewTrade,
        activeTemplateId, checklistState, setChecklistState,
        // Derived
        playbooks, tradeTemplates, symbolRef,
        // Handlers
        set, validate, handleSubmit, autoCalcPnl,
        handleDragOver, handleDragLeave, handleDrop,
        handleTemplateSelect,
    };
}
