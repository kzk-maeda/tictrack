# Gentle Guardian Design System

**TicTrack** - A warm, reassuring interface for caregivers monitoring children's tic symptoms

## Design Philosophy

The "Gentle Guardian" aesthetic combines **Scandinavian healthcare design** with **Japanese minimalism** to create an interface that reduces anxiety and builds trust during stressful moments. Every design decision prioritizes calmness, approachability, and professional care.

---

## Color Palette

### Primary Colors

| Color | HSL | Purpose | Emotion |
|-------|-----|---------|---------|
| **Soft Sage Green** | `145 25% 52%` | Primary actions, navigation | Calm, growth, health |
| **Warm Terracotta** | `15 55% 70%` | Accent, CTAs | Gentle energy, care |
| **Muted Lavender** | `250 20% 88%` | Secondary backgrounds | Soothing, trust |
| **Creamy Off-White** | `42 45% 97%` | Main background | Soft, not harsh |
| **Deep Charcoal** | `220 15% 20%` | Text | Readable, not stark |

### Semantic Colors

| Purpose | Color | HSL |
|---------|-------|-----|
| Success | Natural Green | `145 45% 48%` |
| Warning | Gentle Amber | `35 85% 62%` |
| Destructive | Softened Coral | `5 65% 62%` |

### Design Rationale

- **No harsh whites**: Creamy off-white (HSL 42 45% 97%) reduces eye strain and feels warmer
- **Organic earth tones**: Sage greens and terracotta evoke natural, grounding feelings
- **Desaturated accents**: Muted colors prevent visual overwhelm during emotional moments
- **Clinical precision with warmth**: Professional without being cold or sterile

---

## Typography

### Font Families

```css
/* Body Text */
font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;

/* Headings */
font-family: 'Fraunces', Georgia, serif;
```

### Why These Fonts?

- **DM Sans**: Humanist sans-serif with geometric precision. Clear at small sizes, approachable without being childish
- **Fraunces**: Variable serif with soft, organic curves. Adds personality to headings without formality
- **Fallbacks**: System fonts ensure performance and accessibility

### Typography Scale

| Element | Font | Size | Weight | Letter Spacing |
|---------|------|------|--------|----------------|
| H1 (Logo) | Fraunces | 2xl (24px) | 600 | -0.02em |
| H2 (Page Title) | Fraunces | xl (20px) | 600 | -0.02em |
| Body | DM Sans | sm (14px) | 400 | normal |
| Button | DM Sans | sm (14px) | 500 | normal |
| Caption | DM Sans | sm (14px) | 400 | normal |

---

## Spacing & Layout

### Border Radius

```css
--radius: 0.75rem; /* 12px - generous rounding for soft, approachable feel */
```

- Cards: `rounded-xl` (12px)
- Buttons: `rounded-lg` (8px)
- Inputs: `rounded-lg` (8px)

### Shadows

```css
/* Soft elevation - barely-there depth */
.shadow-soft {
  box-shadow:
    0 1px 3px hsla(220, 15%, 20%, 0.06),
    0 4px 12px hsla(220, 15%, 20%, 0.04);
}

/* Stronger elevation for modals, hovers */
.shadow-soft-lg {
  box-shadow:
    0 4px 8px hsla(220, 15%, 20%, 0.08),
    0 12px 32px hsla(220, 15%, 20%, 0.06);
}
```

**Philosophy**: Shadows create depth without harshness. Low opacity maintains the airy, calm aesthetic.

---

## Motion & Animation

### Principles

1. **Breathing over bouncing**: Slow, organic easing (cubic-bezier) instead of elastic effects
2. **Staggered reveals**: List items fade in with 50-100ms delays for natural flow
3. **Subtle scale**: Active states scale to 0.98 (not 0.95) for gentle feedback
4. **Long durations**: 300ms transitions feel considered, not rushed

### Key Animations

```css
/* Breathing - for loading states */
@keyframes breathe {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.02); }
}
.animate-breathe { animation: breathe 3s ease-in-out infinite; }

/* Fade in up - for page loads */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### Transition Durations

| Element | Duration | Easing |
|---------|----------|--------|
| Button hover | 300ms | ease-in-out |
| Card hover | 300ms | ease-in-out |
| Nav tab switch | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Page transitions | 400ms | cubic-bezier(0.16, 1, 0.3, 1) |

---

## Component Patterns

### Navigation

- **Sticky header** with backdrop blur for depth
- **Gradient logo** (primary → accent → primary) for warmth
- **Active state** has soft shadow, not just background change
- **Staggered fade-in** for nav items (50ms, 100ms, 150ms delays)

### Buttons

| Variant | Style | Use Case |
|---------|-------|----------|
| `default` | Sage green, soft shadow | Primary actions |
| `secondary` | Lavender, soft shadow | Secondary actions |
| `success` | Natural green, soft shadow | Confirmations |
| `destructive` | Coral red, soft shadow | Delete, warnings |
| `outline` | 2px border, hover fills | Tertiary actions |
| `ghost` | Transparent, hover muted | Low-priority |

**Active feedback**: `scale(0.98)` on press for tactile response

### Cards

- `rounded-xl` (12px) with soft shadow
- **Hover state**: Elevates to `shadow-soft-lg` with 300ms transition
- **Serif headings** for visual hierarchy
- **Generous padding** (p-6 = 24px) for breathing room

### Inputs

- `rounded-lg` with 2px border (stronger than typical 1px)
- **Focus state**: Border changes to primary, ring appears at 20% opacity
- **Height**: 44px (11 in Tailwind) for comfortable touch targets

---

## Background Treatments

### Subtle Gradients

```tsx
// Main layout
<div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
  {children}
</div>

// Loading page
<main className="bg-gradient-to-br from-background via-secondary/20 to-background">
  {/* content */}
</main>
```

**Purpose**: Creates atmospheric depth without distracting from content. Gradient is barely perceptible but adds warmth.

---

## Accessibility

### Contrast Ratios

All color combinations meet **WCAG AA** standards:

| Foreground | Background | Ratio | Grade |
|------------|------------|-------|-------|
| Deep Charcoal | Creamy White | 11.2:1 | AAA |
| Primary text | Card bg | 8.5:1 | AAA |
| Muted text | Background | 4.8:1 | AA |

### Touch Targets

- Minimum height: **44px** (inputs, buttons)
- Icon buttons: **40px × 40px**
- Nav items: **40px** height

### Motion

- All animations are decorative, not functional
- `prefers-reduced-motion` respected (TODO: add media query overrides)

---

## Dark Mode

TicTrack includes a dark mode variant with the same warm, calming principles:

- **Deep blues** (HSL 220 20% 12%) instead of pure black
- **Desaturated colors** maintain warmth without eye strain
- **Shadows** use lighter values for depth perception

---

## Usage Examples

### Creating a New Page

```tsx
export default function MyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page header with serif font */}
      <h1 className="text-3xl font-serif font-semibold mb-6">
        Page Title
      </h1>

      {/* Cards with soft shadows */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Section Title</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Content */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Button Variants

```tsx
// Primary action
<Button>Save Changes</Button>

// Secondary action
<Button variant="secondary">Cancel</Button>

// Success confirmation
<Button variant="success">Confirm</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Low-priority
<Button variant="ghost">Learn More</Button>
```

---

## Implementation Checklist

- [x] Update `globals.css` with color palette
- [x] Add Google Fonts (DM Sans, Fraunces)
- [x] Update `tailwind.config.ts` with extended colors
- [x] Update Button component with soft shadows
- [x] Update Card component with rounded corners
- [x] Update Input component with focus styles
- [x] Update Nav component with gradient logo
- [x] Add background gradients to layouts
- [x] Add animation utilities (breathe, fade-in-up)
- [ ] Add `prefers-reduced-motion` overrides
- [ ] Update remaining components (Select, Textarea, etc.)
- [ ] Create storybook/component showcase

---

## Design Principles Summary

1. **Warmth over coldness**: Cream backgrounds, earth tones, serif headings
2. **Softness over sharpness**: Generous radius, low-opacity shadows, muted colors
3. **Breathing over bouncing**: Long transitions, gentle easing, organic motion
4. **Trust over excitement**: Professional but approachable, calm but not boring
5. **Space over density**: Generous padding, clear hierarchy, uncluttered layouts

---

**Last updated**: 2026-03-10
**Design system**: Gentle Guardian v1.0
**Application**: TicTrack (Child Tic Symptom Tracker)
