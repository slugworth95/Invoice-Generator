# Invoice-Generator

A starter template for a tool that creates, tracks, and sends invoices.

## Planned Features

- Invoice editor with line items, tax, and discounts
- Invoice numbering and status tracking (draft, sent, paid)
- Export to PDF
- Payment reminders

## Getting Started

This is a static web app starter — no build step required.

1. Open `index.html` in your browser, or serve the folder:

   ```bash
   # Python
   python -m http.server 8000

   # or Node
   npx serve .
   ```

2. Open http://localhost:8000 in your browser.

## Project Structure

```
Invoice-Generator/
├── index.html      # Main page
├── css/styles.css  # Styles
├── js/app.js       # App logic
└── README.md
```

## Roadmap

- [ ] Line-item editor with live totals
- [ ] Save invoices to localStorage
- [ ] PDF export