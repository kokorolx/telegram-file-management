# File Manager Design System

## Overview
This document defines the unified design system used throughout the File Manager application, ensuring consistency across all UI components.

## Color Palette

### Primary Colors
- **Blue-600**: Primary action buttons and interactive elements
  - Hover: Blue-700
  - Focus ring: Blue-500
  - Light background: Blue-50 (hover states)
  - Selected: Blue-100

- **Red-600**: Destructive actions (delete)
  - Hover: Red-700
  - Text on light: Red-800

- **Purple-600**: Secondary actions (preview)
  - Hover: Purple-700

### Status Colors
- **Error**: Red-50 background, Red-200 border, Red-800 text
- **Success**: Green-50 background, Green-200 border, Green-700 text
- **Warning**: Yellow/Orange backgrounds

### Neutral Colors
- **White**: Card backgrounds
- **Gray-50**: Hover states, light backgrounds
- **Gray-100**: Selected/disabled states
- **Gray-200**: Subtle borders
- **Gray-300**: Default input borders
- **Gray-400**: Disabled text/icons
- **Gray-500**: Secondary text
- **Gray-600**: Metadata text
- **Gray-700**: Body text
- **Gray-900**: Headers and primary text

### Folder-Specific
- Background gradient: `from-blue-50 to-blue-100`
- Border: Blue-200
- Hover border: Blue-400

## Typography

### Font Families
- Sans-serif (Tailwind default): `font-sans`

### Font Weights
| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Metadata, secondary labels |
| Semibold | 600 | Headers, buttons, form labels |
| Bold | 700 | Not typically used |

### Font Sizes
| Size | Value | Usage |
|------|-------|-------|
| text-xs | 12px | Metadata, small info |
| text-sm | 14px | Form labels, button text |
| text-base | 16px | Subsection headers |
| text-lg | 18px | Section headers |
| text-xl | 20px | Page title (legacy) |
| text-2xl | 24px | Main header |
| text-3xl | 30px | Loading emoji |
| text-4xl | 36px | Empty state emoji |

## Spacing System

### Padding
| Class | Value | Usage |
|-------|-------|-------|
| px-2 py-1.5 | 8px / 6px | Small buttons |
| px-3 py-2.5 | 12px / 10px | Standard buttons |
| px-4 py-2.5 | 16px / 10px | Input fields |
| p-4 | 16px | Card padding |
| p-6 | 24px | Form padding |
| p-8 | 32px | Large drop zones |

### Margins & Gaps
| Class | Value | Usage |
|-------|-------|-------|
| gap-1 | 4px | Tight spacing (breadcrumb) |
| gap-2 | 8px | Button groups |
| gap-3 | 12px | Component sections |
| gap-4 | 16px | Columns and sections |
| gap-6 | 24px | Major sections |
| mb-2 | 8px | Small section spacing |
| mb-4 | 16px | Standard spacing |
| mb-6 | 24px | Large section spacing |
| space-y-4 | 16px | Vertical spacing in containers |
| space-y-6 | 24px | Large vertical spacing |

## Borders & Shadows

### Border Radius
| Class | Value | Usage |
|-------|-------|-------|
| rounded | 4px | Legacy (not used) |
| rounded-lg | 8px | All modern components |
| rounded-full | 50% | Pills (tags) |

### Shadows
| Class | Usage |
|-------|-------|
| shadow-sm | Subtle cards (breadcrumb) |
| shadow-md | Standard cards, buttons |
| hover:shadow-lg | Enhanced on hover |

### Borders
| Style | Usage |
|-------|-------|
| border | 1px solid gray-300 (inputs) |
| border border-gray-200 | Card borders |
| border-blue-200 | Folder cards, selected state |
| border-blue-400 | Folder hover |
| border-blue-200/red-200 | Error/status indicators |
| border-2 | NOT USED (removed in redesign) |

## Component Specifications

### Cards
```css
.card {
  background: white;
  border-radius: 8px;
  border: 1px solid rgb(229, 231, 235); /* gray-200 */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  padding: 16px;
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

### Buttons
```css
.button {
  border-radius: 8px;
  font-weight: 600;
  padding: 8px 12px;
  transition: background-color 0.2s ease, 
              border-color 0.2s ease;
  font-size: 14px;
}

.button:disabled {
  background-color: rgb(209, 213, 219); /* gray-400 */
  cursor: not-allowed;
  opacity: 1;
}

.button-primary {
  background-color: rgb(37, 99, 235); /* blue-600 */
  color: white;
}

.button-primary:hover {
  background-color: rgb(29, 78, 216); /* blue-700 */
}

.button-destructive {
  background-color: rgb(220, 38, 38); /* red-600 */
  color: white;
}

.button-destructive:hover {
  background-color: rgb(185, 28, 28); /* red-700 */
}
```

### Input Fields
```css
.input {
  border: 1px solid rgb(209, 213, 219); /* gray-300 */
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.input:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  border-color: transparent;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1),
              0 0 0 2px rgb(37, 99, 235);
}
```

### Error/Status Messages
```css
.error-message {
  background-color: rgb(254, 242, 242); /* red-50 */
  border: 1px solid rgb(254, 205, 211); /* red-200 */
  color: rgb(127, 29, 29); /* red-800 */
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.error-message::before {
  content: "⚠️";
  font-size: 18px;
  flex-shrink: 0;
}
```

## Layout Specifications

### Container Widths
```
Mobile:        100% - 16px padding on each side
Tablet (md):   100% - 24px padding on each side
Desktop (lg):  100% - 32px padding on each side
Large (xl):    max-width: 1280px (max-w-7xl) centered
```

### Grid Layouts
```css
.card-grid-files {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

@media (min-width: 768px) {
  .card-grid-files {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .card-grid-files {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Main layout */
.layout-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 1280px) {
  .layout-main {
    grid-template-columns: 1fr 3fr;
  }
}
```

## Interactive Elements

### Hover States
```css
/* Cards */
.card:hover {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  /* no border change */
}

/* Buttons */
.button:hover:not(:disabled) {
  background-color: /* lighter shade */;
}

/* Links */
.link:hover {
  background-color: rgb(219, 234, 254); /* blue-50 */
  border-radius: 8px;
}

/* Selected state */
.selected {
  background-color: rgb(219, 234, 254); /* blue-100 */
  border: 1px solid rgb(191, 219, 254); /* blue-200 */
}
```

### Focus States
```css
/* All interactive elements */
:focus-visible {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1),
              0 0 0 2px rgb(37, 99, 235);
  border-color: transparent;
}
```

### Disabled States
```css
:disabled {
  background-color: rgb(209, 213, 219); /* gray-400 */
  color: rgb(107, 114, 128); /* gray-500 */
  cursor: not-allowed;
  opacity: 1;
}
```

## Typography System

### Section Headers
```html
<h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
  <span>📤</span>
  Upload File
</h2>
```

### Form Labels
```html
<label class="block text-gray-900 font-semibold mb-2">
  Description
</label>
```

### Metadata
```html
<p class="text-xs text-gray-500 font-medium">
  Created Jan 15, 2024
</p>
```

## Icon System

### Emoji Usage
- **📁**: Folders
- **📂**: Folder open/navigation
- **📄**: Generic file
- **📤**: Upload
- **📚**: Files/content area
- **👁️**: Preview
- **⬇️**: Download
- **🗑️**: Delete
- **⏳**: Loading/processing
- **✓**: Success
- **⚠️**: Warning/error
- **📭**: Empty state
- **◌**: Placeholder/loading (in button)

## Responsive Breakpoints

| Breakpoint | Width | Grid Cols | Usage |
|------------|-------|-----------|-------|
| sm | 640px | - | Mobile tweaks |
| md | 768px | 2 | Tablet, 2-column grid |
| lg | 1024px | 3 | Desktop, 3-column grid |
| xl | 1280px | - | Large screens, sidebar |

## Animation & Transitions

### Standard Transition
```css
transition: all 0.2s ease;
/* OR specific */
transition: background-color 0.2s ease, border-color 0.2s ease;
```

### Loading Animation
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

## Accessibility Standards

### Color Contrast
- Text on white: Gray-900 (WCAG AAA)
- Text on blue: White (WCAG AAA)
- Text on gray-100: Gray-900 (WCAG AAA)
- Error text: Red-800 on Red-50 (WCAG AA)

### Interactive Element Sizes
- Minimum height: 32px for buttons
- Minimum width: 32px for click targets
- Padding: Minimum 8px around interactive elements

### Focus Indicators
- Visible on all interactive elements
- Ring-based (not outline-based) for better browser support
- Color: Blue-500 (matches brand)
- Visibility: AA standard

## Browser Support
- Chrome/Edge: 90+
- Firefox: 88+
- Safari: 14+
- Mobile browsers: iOS Safari 14+, Chrome Android latest

## Implementation Notes

1. **Never mix shadow classes**: Use only `shadow-sm`, `shadow-md`, or `hover:shadow-lg`
2. **Consistent border radius**: Always use `rounded-lg` (8px) for modern components
3. **Focus states**: Prefer `focus:ring-2` over `focus:outline-none`
4. **Disabled states**: Use gray-400 background with cursor-not-allowed
5. **Hover transitions**: Always specify `transition-colors` or `transition`
6. **Card borders**: Always pair with `border border-gray-200`
7. **Error messages**: Always include emoji icon and use flex layout

## Spacing Cheat Sheet
```
Small spacing (gap-1/gap-2):    4-8px   (breadcrumb, tight)
Medium spacing (gap-3/gap-4):   12-16px (sections)
Large spacing (gap-6):          24px    (major sections)
Card padding:                   16px (p-4) or 24px (p-6)
Button padding:                 8px-12px h, 12px w
Input padding:                  10px h, 16px w
```

## Future Enhancements
- Dark mode color palette
- Semantic color tokens (e.g., `--color-primary`)
- CSS variables for theme switching
- Animation library integration
- Custom icon SVG system
