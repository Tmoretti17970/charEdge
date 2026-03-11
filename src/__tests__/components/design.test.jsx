// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// charEdge — Design System Component Render Tests
//
// Ensures all 9 design components render without crashing and have
// correct ARIA attributes. Uses @testing-library/react.
// ═══════════════════════════════════════════════════════════════════

import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/order
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

// ─── Component Imports ──────────────────────────────────────────
import Avatar from '../../app/components/design/Avatar.jsx';
import Badge from '../../app/components/design/Badge.jsx';
import Button from '../../app/components/design/Button.jsx';
import Card from '../../app/components/design/Card.jsx';
import Dialog from '../../app/components/design/Dialog.jsx';
import Input from '../../app/components/design/Input.jsx';
import Skeleton from '../../app/components/design/Skeleton.jsx';
import { ToastContainer } from '../../app/components/design/Toast.jsx';
import Tooltip from '../../app/components/design/Tooltip.jsx';

// ═══════════════════════════════════════════════════════════════════
// Avatar
// ═══════════════════════════════════════════════════════════════════
describe('Avatar', () => {
  it('renders initials fallback when no src', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByTitle('John Doe')).toBeTruthy();
    expect(screen.getByTitle('John Doe').textContent).toBe('JD');
  });

  it('renders image when src provided', () => {
    render(<Avatar name="Jane" src="/avatar.jpg" />);
    const img = screen.getByAltText('Jane');
    expect(img).toBeTruthy();
    expect(img.tagName).toBe('IMG');
  });

  it('supports size variants', () => {
    const { container } = render(<Avatar name="X" size="lg" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows status dot when status provided', () => {
    const { container } = render(<Avatar name="X" status="online" />);
    const dot = container.querySelector('span');
    expect(dot).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tooltip
// ═══════════════════════════════════════════════════════════════════
describe('Tooltip', () => {
  it('renders trigger children', () => {
    render(<Tooltip content="Hello"><button>Hover me</button></Tooltip>);
    expect(screen.getByText('Hover me')).toBeTruthy();
  });

  it('shows tooltip on hover', async () => {
    render(<Tooltip content="Tip text" delay={0}><span>trigger</span></Tooltip>);
    fireEvent.mouseEnter(screen.getByText('trigger'));
    // Wait for state update + AnimatePresence
    await new Promise((r) => setTimeout(r, 100));
    const tooltip = screen.queryByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain('Tip text');
  });

  it('does not show tooltip when disabled', () => {
    render(<Tooltip content="Hidden" disabled><span>trigger</span></Tooltip>);
    fireEvent.mouseEnter(screen.getByText('trigger'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Dialog
// ═══════════════════════════════════════════════════════════════════
describe('Dialog', () => {
  it('does not render when closed', () => {
    render(<Dialog open={false} onClose={() => {}}>Content</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders with correct ARIA attributes when open', () => {
    render(<Dialog open={true} onClose={() => {}} title="Test Dialog">Content</Dialog>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} title="Test">Body</Dialog>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders title and footer', () => {
    render(
      <Dialog open={true} onClose={() => {}} title="My Title" footer={<button>OK</button>}>
        Body text
      </Dialog>
    );
    expect(screen.getByText('My Title')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
    expect(screen.getByText('Body text')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Toast
// ═══════════════════════════════════════════════════════════════════
describe('Toast', () => {
  it('ToastContainer renders without crash', () => {
    const { container } = render(<ToastContainer />);
    // No toasts visible by default
    expect(container.innerHTML).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Button
// ═══════════════════════════════════════════════════════════════════
describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByText('Go'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Card
// ═══════════════════════════════════════════════════════════════════
describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Input
// ═══════════════════════════════════════════════════════════════════
describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Symbol" />);
    expect(screen.getByText('Symbol')).toBeTruthy();
  });

  it('renders error message', () => {
    render(<Input label="Price" error="Required field" />);
    expect(screen.getByText('Required field')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Badge
// ═══════════════════════════════════════════════════════════════════
describe('Badge', () => {
  it('renders with text', () => {
    render(<Badge>Pro</Badge>);
    expect(screen.getByText('Pro')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════════════════
describe('Skeleton', () => {
  it('renders without crash', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});
