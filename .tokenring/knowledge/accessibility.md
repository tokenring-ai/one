# Accessibility Knowledge Base

Comprehensive guide to web accessibility, WCAG guidelines, ARIA best practices, and usability patterns.

## Table of Contents

- [WCAG 2.1 Guidelines](#wcag-21-guidelines)
- [Four Principles of Accessibility](#four-principles-of-accessibility)
- [ARIA Best Practices](#aria-best-practices)
- [Semantic HTML](#semantic-html)
- [Keyboard Navigation](#keyboard-navigation)
- [Focus Management](#focus-management)
- [Color Contrast](#color-contrast)
- [Screen Reader Support](#screen-reader-support)
- [Form Accessibility](#form-accessibility)
- [Responsive Design](#responsive-design)
- [Common Accessibility Patterns](#common-accessibility-patterns)
- [Testing Tools](#testing-tools)

---

## WCAG 2.1 Guidelines

Web Content Accessibility Guidelines (WCAG) 2.1 is the current standard for web accessibility.

### Conformance Levels

- **Level A**: Minimum level of accessibility (must satisfy all Level A criteria)
- **Level AA**: Addresses major barriers (target for most websites, must satisfy all Level A and AA criteria)
- **Level AAA**: Highest level of accessibility (may not be achievable for all content)

### Success Criteria Categories

1. **Perceivable**: Information and user interface components must be presentable to users in ways they can perceive
2. **Operable**: User interface components and navigation must be operable
3. **Understandable**: Information and operation of user interface must be understandable
4. **Robust**: Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies

---

## Four Principles of Accessibility (POUR)

### 1. Perceivable

Content must be presentable to users in ways they can perceive.

**Key Requirements:**
- Provide text alternatives for non-text content
- Provide captions and alternatives for multimedia
- Create content that can be presented in different ways
- Make it easier for users to see and hear content

**Examples:**
```html
<!-- Alt text for images -->
<img src="chart.png" alt="Sales increased 25% in Q3 2024">

<!-- Audio description for video -->
<video controls>
  <source src="video.mp4" type="video/mp4">
  <track kind="captions" src="captions.vtt" label="English">
  <track kind="descriptions" src="descriptions.vtt" label="English">
</video>

<!-- High contrast text -->
<p class="high-contrast">Important information</p>
```

### 2. Operable

User interface components and navigation must be operable.

**Key Requirements:**
- Make all functionality available from a keyboard
- Give users enough time to read and use content
- Do not design content in a way that causes seizures
- Provide ways to help users navigate and find content
- Make it easier to use inputs other than keyboard

**Examples:**
```html
<!-- Keyboard accessible button -->
<button type="button" onclick="handleClick()">Click Me</button>

<!-- Skip navigation link -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Visible focus indicators -->
:focus {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

### 3. Understandable

Information and operation of user interface must be understandable.

**Key Requirements:**
- Make text readable and understandable
- Make content appear and operate in predictable ways
- Help users avoid and correct mistakes

**Examples:**
```html
<!-- Clear form labels -->
<label for="email">Email Address</label>
<input type="email" id="email" name="email" required>

<!-- Error messages with context -->
<div role="alert" aria-live="polite">
  <p>Please enter a valid email address (e.g., name@example.com)</p>
</div>

<!-- Consistent navigation -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

### 4. Robust

Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies.

**Key Requirements:**
- Maximize compatibility with current and future user tools
- Use valid, semantic HTML
- Ensure compatibility with assistive technologies

**Examples:**
```html
<!-- Valid semantic HTML -->
<header>
  <h1>Website Title</h1>
  <nav aria-label="Primary">...</nav>
</header>

<main id="main-content">
  <article>
    <h2>Article Title</h2>
    <p>Content here...</p>
  </article>
</main>

<footer>
  <p>Copyright 2024</p>
</footer>
```

---

## ARIA Best Practices

### When to Use ARIA

**Rule of thumb**: Use native HTML elements first. Only use ARIA when native HTML is insufficient.

```html
<!-- Good: Native button -->
<button>Click me</button>

<!-- Avoid: Div with role (unless necessary) -->
<div role="button" tabindex="0" onclick="handleClick()">Click me</div>
```

### ARIA Roles

#### Landmark Roles
```html
<header role="banner">Site header</header>
<nav role="navigation">Main navigation</nav>
<main role="main">Main content</main>
<aside role="complementary">Sidebar</aside>
<footer role="contentinfo">Site footer</footer>
<form role="search">Search form</form>
```

#### Widget Roles
```html
<div role="alert" aria-live="assertive">Important message</div>
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Dialog Title</h2>
</div>
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel1">Tab 1</button>
  <button role="tab" aria-selected="false" aria-controls="panel2">Tab 2</button>
</div>
<div role="tabpanel" id="panel1">Panel 1 content</div>
```

#### Live Regions
```html
<!-- Polite updates (announced when user is idle) -->
<div aria-live="polite" aria-atomic="true">
  Status: Loading...
</div>

<!-- Assertive updates (announced immediately) -->
<div aria-live="assertive" aria-atomic="true">
  Error: Form submission failed!
</div>

<!-- Timer updates -->
<div aria-live="off" aria-busy="true">
  Processing...
</div>
```

### ARIA States and Properties

#### Common States
```html
<!-- Expanded/Collapsed -->
<button aria-expanded="false" aria-controls="menu">Menu</button>

<!-- Selected -->
<div role="option" aria-selected="true">Option 1</div>

<!-- Disabled -->
<button aria-disabled="true">Disabled Button</button>

<!-- Checked -->
<div role="checkbox" aria-checked="true">Checkbox</div>

<!-- Hidden -->
<div aria-hidden="true">Decorative content</div>
```

#### Common Properties
```html
<!-- Labeling -->
<button aria-label="Close dialog">✕</button>
<div aria-labelledby="heading-id">Content</div>

<!-- Describing -->
<input aria-describedby="help-text" type="text">
<span id="help-text">Enter your email address</span>

<!-- Relationships -->
<div aria owns="child1 child2">Parent</div>
<div id="child1">Child 1</div>
<div id="child2">Child 2</div>

<!-- Position -->
<div role="listitem" aria-posinset="2" aria-setsize="5">Item 2 of 5</div>
```

### ARIA Best Practices

1. **Don't change native semantics**: Don't add ARIA to elements that already have the correct semantics
2. **All interactive elements must be keyboard accessible**
3. **All ARIA states, properties, and roles must be valid**
4. **Don't hide focusable elements**: `aria-hidden="true"` should not be used on focusable elements
5. **Use meaningful names**: ARIA labels should be descriptive

```html
<!-- Bad: Redundant role -->
<button role="button">Click me</button>

<!-- Good: Native semantics -->
<button>Click me</button>

<!-- Bad: Hiding focusable element -->
<a href="#" aria-hidden="true">Link</a>

<!-- Good: Non-interactive decorative content -->
<span aria-hidden="true">★</span>
```

---

## Semantic HTML

### Proper Document Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  
  <header>
    <h1>Site Title</h1>
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content">
    <article>
      <h1>Article Title</h1>
      <p>Content...</p>
    </article>
  </main>

  <aside>
    <h2>Sidebar</h2>
    <p>Related content</p>
  </aside>

  <footer>
    <p>Copyright 2024</p>
  </footer>
</body>
</html>
```

### Heading Hierarchy

```html
<!-- Good: Logical heading hierarchy -->
<h1>Main Page Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>
<h4>Sub-subsection Title</h4>

<!-- Bad: Skipped heading levels -->
<h1>Main Title</h1>
<h3>Skipped h2</h3> <!-- Should be h2 -->
```

### Lists

```html
<!-- Ordered list -->
<ol>
  <li>First item</li>
  <li>Second item</li>
</ol>

<!-- Unordered list -->
<ul>
  <li>Item one</li>
  <li>Item two</li>
</ul>

<!-- Description list -->
<dl>
  <dt>Term</dt>
  <dd>Definition</dd>
</dl>
```

### Tables

```html
<table>
  <caption>Monthly Sales Data</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Sales</th>
      <th scope="col">Growth</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">January</th>
      <td>$1,234</td>
      <td>+5%</td>
    </tr>
  </tbody>
</table>
```

---

## Keyboard Navigation

### Focusable Elements

All interactive elements must be keyboard accessible:

```html
<!-- Native focusable elements -->
<a href="#">Link</a>
<button>Button</button>
<input type="text">
<select>
  <option>Option</option>
</select>
<textarea></textarea>

<!-- Custom focusable elements -->
<div tabindex="0" role="button" onclick="handleClick()">Custom Button</div>
<div tabindex="0" role="link" onclick="handleLink()">Custom Link</div>
```

### Keyboard Patterns

#### Tab Order
```html
<!-- Natural tab order (follows DOM order) -->
<button>First</button>
<button>Second</button>
<button>Third</button>

<!-- Avoid positive tabindex -->
<div tabindex="1">Avoid</div> <!-- Bad practice -->
<div tabindex="0">Good</div>  <!-- Natural tab order -->
```

#### Custom Keyboard Handling
```javascript
// Handle keyboard events for custom components
element.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleClick();
  }
  
  if (event.key === 'Escape') {
    handleClose();
  }
  
  // Arrow key navigation
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateToNext();
  }
});
```

#### Focus Trapping (Modal Dialogs)
```javascript
function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });
}
```

---

## Focus Management

### Visible Focus Indicators

```css
/* Default focus indicator */
:focus {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}

/* Custom focus indicator */
:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}

/* Remove focus only when using mouse (not recommended for accessibility) */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Focus Order

```html
<!-- Logical focus order -->
<form>
  <label for="name">Name</label>
  <input id="name" type="text">
  
  <label for="email">Email</label>
  <input id="email" type="email">
  
  <button type="submit">Submit</button>
</form>
```

### Focus Management in Single Page Applications

```javascript
// Move focus to main content after navigation
function navigateToPage(newContent) {
  // Update content
  document.getElementById('main-content').innerHTML = newContent;
  
  // Move focus to main content
  const mainContent = document.getElementById('main-content');
  mainContent.setAttribute('tabindex', '-1');
  mainContent.focus();
}

// Return focus after modal closes
function openModal() {
  // Store current focus
  this.previousFocus = document.activeElement;
  
  // Show modal and focus first element
  modal.show();
  modal.querySelector('button').focus();
}

function closeModal() {
  modal.hide();
  // Return focus to previous element
  this.previousFocus?.focus();
}
```

---

## Color Contrast

### Minimum Contrast Ratios (WCAG 2.1)

- **Level AA**: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
- **Level AAA**: 7:1 for normal text, 4.5:1 for large text

### Color Contrast Examples

```css
/* Good contrast (4.5:1+) */
.text {
  color: #333333; /* Dark gray on white */
  background-color: #ffffff;
}

.button {
  color: #ffffff;
  background-color: #005fcc; /* White on blue */
}

/* Poor contrast (avoid) */
.poor-contrast {
  color: #999999; /* Light gray on white - fails */
  background-color: #ffffff;
}
```

### Testing Tools

- WebAIM Contrast Checker
- Chrome DevTools Accessibility Audit
- axe DevTools
- Color Oracle (color blindness simulator)

---

## Screen Reader Support

### Announcing Content Changes

```html
<!-- Live regions for dynamic content -->
<div aria-live="polite" aria-atomic="true">
  <span id="status">Loading...</span>
</div>

<!-- Error announcements -->
<div role="alert" aria-live="assertive">
  <p>Error: Please correct the following issues</p>
</div>

<!-- Progress updates -->
<div role="status" aria-live="polite" aria-atomic="true">
  <p>Progress: <span id="progress-text">50%</span></p>
  <progress value="50" max="100"></progress>
</div>
```

### Hiding Content from Screen Readers

```html
<!-- Decorative images -->
<img src="decorative-line.png" alt="" role="presentation">

<!-- Non-essential content -->
<div aria-hidden="true">
  This content is only for visual users
</div>

<!-- Icon-only buttons with label -->
<button aria-label="Close">
  <span aria-hidden="true">✕</span>
</button>
```

### Screen Reader Announcements

```javascript
// Announce message to screen readers
function announce(message, priority = 'polite') {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.textContent = message;
  
  document.body.appendChild(liveRegion);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(liveRegion);
  }, 1000);
}

// Usage
announce('Form submitted successfully');
announce('Error: Invalid email address', 'assertive');
```

---

## Form Accessibility

### Labels and Descriptions

```html
<!-- Associated labels -->
<label for="email">Email Address</label>
<input type="email" id="email" name="email" required>

<!-- Grouping related fields -->
<fieldset>
  <legend>Preferred Contact Method</legend>
  <input type="radio" id="email" name="contact" value="email">
  <label for="email">Email</label>
  
  <input type="radio" id="phone" name="contact" value="phone">
  <label for="phone">Phone</label>
</fieldset>

<!-- Help text -->
<label for="password">Password</label>
<input type="password" id="password" name="password" 
       aria-describedby="password-help">
<span id="password-help">Must be at least 8 characters</span>
```

### Error Handling

```html
<!-- Error message with association -->
<label for="username">Username</label>
<input type="text" id="username" name="username" 
       aria-invalid="true" aria-describedby="username-error">
<span id="username-error" role="alert">
  Username is required
</span>

<!-- Form-level errors -->
<form novalidate>
  <div role="alert" aria-live="assertive">
    <h2>Form Submission Error</h2>
    <ul>
      <li><a href="#email">Email is required</a></li>
      <li><a href="#phone">Phone number is invalid</a></li>
    </ul>
  </div>
  
  <label for="email">Email</label>
  <input type="email" id="email" aria-invalid="true">
</form>
```

### Required Fields

```html
<!-- Visual and programmatic indication -->
<label for="name">
  Name <span aria-hidden="true">*</span>
  <span class="sr-only">(required)</span>
</label>
<input type="text" id="name" required aria-required="true">
```

---

## Responsive Design

### Mobile Accessibility

```css
/* Touch target size (minimum 44x44px) */
.button {
  min-width: 44px;
  min-height: 44px;
  padding: 12px 24px;
}

/* Responsive text */
.text {
  font-size: 1rem; /* Base size */
}

@media (max-width: 768px) {
  .text {
    font-size: 1.125rem; /* Larger on mobile */
  }
}

/* Avoid horizontal scrolling */
.container {
  max-width: 100%;
  overflow-x: hidden;
}
```

### Zoom and Reflow

```css
/* Allow text resizing up to 200% */
html {
  font-size: 16px;
}

/* Avoid fixed widths */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

/* Responsive images */
img {
  max-width: 100%;
  height: auto;
}
```

---

## Common Accessibility Patterns

### Modal Dialogs

```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Dialog Title</h2>
  <p>Dialog content...</p>
  <button onclick="closeModal()">Close</button>
</div>
```

### Dropdown Menus

```html
<div class="dropdown">
  <button aria-expanded="false" aria-controls="dropdown-menu">
    Menu
  </button>
  <ul id="dropdown-menu" role="menu" hidden>
    <li role="none">
      <a role="menuitem" href="#">Item 1</a>
    </li>
    <li role="none">
      <a role="menuitem" href="#">Item 2</a>
    </li>
  </ul>
</div>
```

### Tabs

```html
<div role="tablist" aria-label="Content tabs">
  <button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1">
    Tab 1
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel-2" id="tab-2">
    Tab 2
  </button>
</div>

<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  Panel 1 content
</div>

<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
  Panel 2 content
</div>
```

### Accordions

```html
<div class="accordion">
  <h3>
    <button aria-expanded="false" aria-controls="accordion-1">
      Section 1
    </button>
  </h3>
  <div id="accordion-1" role="region" aria-labelledby="accordion-1" hidden>
    <p>Content for section 1</p>
  </div>
  
  <h3>
    <button aria-expanded="false" aria-controls="accordion-2">
      Section 2
    </button>
  </h3>
  <div id="accordion-2" role="region" aria-labelledby="accordion-2" hidden>
    <p>Content for section 2</p>
  </div>
</div>
```

### Carousels

```html
<div role="region" aria-label="Image carousel">
  <div class="carousel-track" role="list">
    <div role="listitem" aria-hidden="false">
      <img src="image1.jpg" alt="Description of image 1">
    </div>
    <div role="listitem" aria-hidden="true">
      <img src="image2.jpg" alt="Description of image 2">
    </div>
  </div>
  
  <div class="carousel-controls">
    <button aria-label="Previous slide">←</button>
    <button aria-label="Next slide">→</button>
  </div>
  
  <div class="carousel-dots" role="tablist" aria-label="Slide navigation">
    <button role="tab" aria-selected="true" aria-controls="slide-1">1</button>
    <button role="tab" aria-selected="false" aria-controls="slide-2">2</button>
  </div>
</div>
```

---

## Testing Tools

### Automated Testing

- **axe-core**: Comprehensive accessibility testing engine
- **WAVE**: Web Accessibility Evaluation Tool
- **Lighthouse**: Built into Chrome DevTools
- **HTML_CodeSniffer**: Accessibility validator
- **pa11y**: Automated accessibility testing tool

### Manual Testing

- **Keyboard navigation**: Test all functionality with keyboard only
- **Screen readers**: Test with NVDA, JAWS, VoiceOver
- **Zoom testing**: Test at 200% zoom
- **Color blindness**: Use color blindness simulators
- **Responsive testing**: Test on various devices and screen sizes

### Accessibility Audit Checklist

- [ ] All images have appropriate alt text
- [ ] Color contrast meets WCAG AA standards
- [ ] All functionality is keyboard accessible
- [ ] Focus indicators are visible
- [ ] Form fields have associated labels
- [ ] Error messages are clear and accessible
- [ ] Content has proper heading hierarchy
- [ ] Live regions announce dynamic content
- [ ] Skip navigation links are present
- [ ] Language is specified on HTML element
- [ ] No content that causes seizures
- [ ] Text can be resized to 200% without loss of functionality

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [MDN Web Docs - Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Inclusive Components](https://inclusive-components.design/)

---

*This knowledge base should be kept up-to-date with the latest accessibility standards and best practices.*
