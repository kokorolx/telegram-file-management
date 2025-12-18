# UX/UI Quick Reference Guide

## What Changed - At a Glance

### 🎯 Container Sizing
- **Before**: `container mx-auto` (flexible width)
- **After**: `max-w-7xl mx-auto` (max 1280px, centered)
- **Effect**: Professional, contained layout on large screens

### 🏷️ Card Styling
- **Before**: `shadow hover:shadow-lg`
- **After**: `shadow-md border border-gray-200 hover:shadow-lg`
- **Effect**: Consistent, defined card appearance

### 🎨 Input Focus
- **Before**: `focus:border-blue-500`
- **After**: `focus:ring-2 focus:ring-blue-500 focus:border-transparent`
- **Effect**: Modern ring-based focus indicator

### ⚠️ Error Messages
- **Before**: `bg-red-100 border-red-400 text-red-700`
- **After**: `bg-red-50 border-red-200 text-red-800 flex items-start gap-3` + emoji
- **Effect**: Softer, more modern error display

### 🔘 Buttons
- **Before**: `rounded font-medium`
- **After**: `rounded-lg font-semibold transition-colors`
- **Effect**: More rounded, bolder, smoother

## Component Styling Patterns

### Every Card Should Have
```jsx
className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition p-4"
```

### Every Input Should Have
```jsx
className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
```

### Every Button Should Have
```jsx
className="px-3 py-2 rounded-lg font-semibold hover:bg-[color-700] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
```

### Every Error Message Should Have
```jsx
className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3"
// With: <span>⚠️</span> as first child
```

### Every Section Header Should Have
```jsx
className="text-lg font-semibold text-gray-900 flex items-center gap-2"
// With emoji as first child: <span>📤</span>
```

## Color Quick Reference

| Element | Normal | Hover | Focus | Disabled |
|---------|--------|-------|-------|----------|
| Primary Button | blue-600 | blue-700 | ring-blue-500 | gray-400 |
| Destructive Button | red-600 | red-700 | ring-blue-500 | gray-400 |
| Input Border | gray-300 | gray-300 | transparent | gray-300 |
| Input Focus Ring | - | - | ring-blue-500 | - |
| Card Border | gray-200 | gray-200 | - | - |
| Error Background | red-50 | - | - | - |
| Success Background | green-50 | - | - | - |

## Spacing Patterns

### Between Components
```
gap-6 or space-y-6    = 24px (major sections)
gap-4 or space-y-4    = 16px (standard sections)
gap-2 or space-y-2    = 8px  (minor spacing)
```

### Inside Components
```
Card padding:        p-4 (16px) or p-6 (24px)
Button padding:      px-3 py-2 (12px h, varies w)
Input padding:       px-4 py-2.5 (16px h, 16px w)
Form label margin:   mb-2
Section margin:      mb-4 or mb-6
```

## Typography Quick Reference

| Element | Size | Weight | Color | Usage |
|---------|------|--------|-------|-------|
| Main Title | text-2xl | font-bold | gray-900 | Page header |
| Section Header | text-lg | font-semibold | gray-900 | Major sections |
| Subsection | text-base | font-semibold | gray-900 | Subsection |
| Form Label | text-sm | font-semibold | gray-900 | Form fields |
| Button Text | text-sm | font-semibold | white | Button text |
| Body Text | text-sm | normal | gray-700 | Description |
| Metadata | text-xs | font-medium | gray-500 | Dates, sizes |

## Common Patterns

### Section Structure
```jsx
<section>
  <div className="mb-2">
    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
      <span>📤</span>
      Section Title
    </h2>
    <p className="text-xs text-gray-600 mt-1">Optional subtitle</p>
  </div>
  {/* Content */}
</section>
```

### Error Handling
```jsx
{error && (
  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
    <span>⚠️</span>
    <span>{error}</span>
  </div>
)}
```

### Empty State
```jsx
<div className="flex flex-col items-center justify-center py-12 text-gray-500">
  <p className="text-4xl mb-3">📭</p>
  <p className="font-medium text-center">Main message</p>
  <p className="text-sm mt-1">Subtitle or suggestion</p>
</div>
```

### Loading State
```jsx
<div className="flex flex-col items-center justify-center py-12 text-gray-500">
  <p className="text-3xl mb-2">⏳</p>
  <p className="font-medium">Loading...</p>
</div>
```

### Button Group
```jsx
<div className="flex gap-2">
  <button className="flex-1 bg-blue-600 ...">
    📤 Upload
  </button>
  <button className="flex-1 bg-red-600 ...">
    🗑️ Delete
  </button>
</div>
```

### Breadcrumb
```jsx
<nav className="flex items-center gap-1 text-sm bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
  {breadcrumbs.map((crumb, i) => (
    <div key={crumb.id} className="flex items-center gap-1">
      <button className={`px-2.5 py-1.5 rounded-lg font-medium ${isCurrent ? 'text-gray-900 bg-gray-100' : 'text-blue-600 hover:bg-blue-50'}`}>
        {crumb.name}
      </button>
      {i < breadcrumbs.length - 1 && <span className="text-gray-400 px-1">/</span>}
    </div>
  ))}
</nav>
```

## Icon Reference

| Icon | Emoji | Usage |
|------|-------|-------|
| Folder | 📁 | Navigation, empty folder |
| Folder Open | 📂 | Open action, current location |
| File | 📄 | File display |
| Upload | 📤 | Upload action |
| Files | 📚 | Files section |
| Eye | 👁️ | Preview action |
| Download | ⬇️ | Download action |
| Delete | 🗑️ | Delete action |
| Hour Glass | ⏳ | Loading state |
| Check | ✓ | Success |
| Warning | ⚠️ | Error/Warning |
| Empty Mailbox | 📭 | Empty state |
| Dot | ◌ | Loading in button |

## File-by-File Checklist

### When Creating/Updating a Component
- [ ] Card has `shadow-md border border-gray-200`
- [ ] Buttons have `rounded-lg font-semibold transition-colors`
- [ ] Inputs have `focus:ring-2 focus:ring-blue-500`
- [ ] Errors use `bg-red-50 border border-red-200 flex items-start gap-3`
- [ ] Section headers use emoji pattern
- [ ] Spacing follows gap-6/gap-4/gap-2 hierarchy
- [ ] Hover states are defined
- [ ] Disabled states are styled
- [ ] Loading states are friendly (emoji + text)
- [ ] Empty states are helpful (emoji + message + suggestion)

## Before Deploying
```bash
# Build check
npm run build

# Visual checklist
- [ ] Colors match design system
- [ ] Spacing is consistent
- [ ] All buttons have rounded-lg
- [ ] All cards have borders
- [ ] Focus states are visible
- [ ] Empty states are friendly
- [ ] Loading states are clear
- [ ] Error messages are helpful
- [ ] Mobile layout works (check md/lg/xl breakpoints)
- [ ] No tailwind warnings in console
```

## Common Gotchas

❌ **DON'T**:
- Use `rounded` (too small, 4px)
- Use `shadow` without `shadow-md` consistency
- Use `focus:border-color` without `focus:ring`
- Mix border styles (thick vs thin)
- Use old color codes (bg-red-100)
- Forget transition-colors on hover
- Skip error emoji icons
- Use `lg:` when you mean `xl:`

✅ **DO**:
- Use `rounded-lg` (8px, modern)
- Use `shadow-md` consistently
- Use `focus:ring-2 focus:ring-blue-500`
- Use 1px borders (border not border-2)
- Use softer colors (red-50, blue-50)
- Add `transition-colors` to hover states
- Include emoji in error messages
- Test all breakpoints

## Quick Style Additions

Need to add a component? Copy-paste these base classes:

### Card Base
```html
class="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition p-4"
```

### Button Base (Primary)
```html
class="px-3 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
```

### Input Base
```html
class="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
```

### Section Title Base
```html
class="text-lg font-semibold text-gray-900 flex items-center gap-2"
```

## Testing Checklist

- [ ] Desktop (1280px+): sidebar visible, 3-column grid
- [ ] Tablet (768px): sidebar visible, 2-column grid
- [ ] Mobile (< 768px): single column, sidebar hidden
- [ ] Focus states: all buttons/inputs focusable
- [ ] Keyboard nav: tab through all elements
- [ ] Error display: errors are clearly visible
- [ ] Loading state: not blocking or confusing
- [ ] Empty state: message is helpful
- [ ] Color contrast: text is readable (WCAG AA)
- [ ] Touch targets: buttons are 32px+ in height
