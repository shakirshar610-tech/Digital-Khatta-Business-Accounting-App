# Digital Khatta — Business Accounting App

**A Digital Business Ledger for Everyday Accounting**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open%20App-2563EB?style=for-the-badge)](https://remix-digital-khata-business-accounting-app-8210.ai.studio/)
[![TypeScript](https://img.shields.io/badge/TypeScript-React-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Built%20With-Vite-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Integration-Firebase-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)

## Overview

Digital Khatta is a digital business accounting and bookkeeping web application designed to help businesses organize their financial activities and daily records.

The project combines a React and TypeScript application structure with Vite, Tailwind CSS, Firebase-related configuration, and Progressive Web App (PWA) initialization. Its codebase includes dedicated modules for khata management, expenses, inventory, invoices, and staff payroll, alongside supporting components for backup/synchronization and bilingual translations.

The goal is to provide a structured foundation for digital business record management and reduce dependence on traditional paper-based bookkeeping.

## Live Application

**[Launch Digital Khatta](https://remix-digital-khata-business-accounting-app-8210.ai.studio/)**

## Key Modules

The repository includes the following module components:

| Module | Component | Purpose |
|---|---|---|
| Khata Management | `KhataModule.tsx` | Business ledger and khata workflows |
| Expense Management | `ExpensesModule.tsx` | Expense-related workflows |
| Inventory Management | `InventoryModule.tsx` | Inventory-related workflows |
| Invoice Management | `InvoicesModule.tsx` | Invoice-related workflows |
| Staff Payroll | `StaffPayrollModule.tsx` | Staff payroll workflows |
| Backup & Sync | `BackupSyncModal.tsx` | Backup and synchronization interface |
| PWA Installation | `PWAInstallButton.tsx` | Progressive Web App installation interface |

These components are present in the repository. The exact operations, validation rules, and persistence behavior of each module depend on its implementation.

## Technology Stack

- **React:** Component-based user interface development.
- **TypeScript:** Typed application development.
- **Vite:** Development server and build tooling.
- **Tailwind CSS:** Utility-first styling.
- **Firebase:** Application configuration and integration infrastructure.
- **Cloud Firestore:** Firestore security rules and related tests are present in the repository.
- **Progressive Web App (PWA):** PWA initialization and installation-related components.
- **Bun:** Dependency lockfile included in the repository.
- **Internationalization (i18n):** Translation resources for bilingual support.
- **ESLint:** Code quality and linting configuration.

## Repository Structure

```text
Digital-Khatta-Business-Accounting-App/
├── public/
│   ├── apple-touch-icon.png
│   ├── icon.svg
│   ├── pwa-192x192.png
│   └── pwa-maskable-512x512.png
├── src/
│   ├── components/
│   │   ├── BackupSyncModal.tsx
│   │   ├── ExpensesModule.tsx
│   │   ├── InventoryModule.tsx
│   │   ├── InvoicesModule.tsx
│   │   ├── KhataModule.tsx
│   │   ├── PWAInstallButton.tsx
│   │   └── StaffPayrollModule.tsx
│   ├── hooks/
│   │   ├── useOnlineStatus.ts
│   │   └── usePWAInstall.ts
│   ├── i18n/
│   │   └── translations.ts
│   ├── lib/
│   │   ├── firebase.ts
│   │   └── sampleData.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── types.ts
├── .env.example
├── .gitignore
├── bun.lock
├── eslint.config.js
├── firebase-applet-config.json
├── firebase-blueprint.json
├── firestore.rules
├── firestore.rules.test.ts
├── index.html
├── metadata.json
├── package.json
├── security_spec.md
├── tsconfig.json
└── vite.config.ts
```

*This structure summarizes the files visible in the repository screenshots. It may not show every file or nested directory.*

## Getting Started

### Prerequisites

Install the following tools:

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)
- [Node.js](https://nodejs.org/), if required by the selected runtime and dependencies

### 1. Clone the Repository

```bash
git clone https://github.com/shakirshar610-tech/Digital-Khatta-Business-Accounting-App.git
```

### 2. Enter the Project Directory

```bash
cd Digital-Khatta-Business-Accounting-App
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Configure Environment Variables

Review `.env.example` to understand the environment variables expected by the application.

The example configuration references:

- `GEMINI_API_KEY` — for Gemini API calls, as described in the example file.
- `APP_URL` — the hosted application URL, as described in the example file.

Configure only the variables required by the current implementation. Use the development environment's secret-management facilities for sensitive values, and never commit real API keys or private credentials.

Firebase configuration may also be necessary for the relevant application workflows.

### 5. Start the Development Server

Check `package.json` for the available scripts. If the standard Vite development script is defined, run:

```bash
bun run dev
```

Open the local URL displayed in the terminal.

### 6. Build for Production

If the corresponding scripts exist in `package.json`, use:

```bash
bun run build
```

To preview a production build locally, if a preview script is configured:

```bash
bun run preview
```

## Firebase and Data Management

The project contains Firebase-related configuration, a Firebase integration file, Firestore rules, and a Firestore rules test file.

Before using real business records:

- Confirm the correct Firebase project and environment.
- Review Firestore security rules and access permissions.
- Verify how financial records are stored and retrieved.
- Test data validation and unauthorized-access scenarios.
- Confirm the backup and synchronization behavior.
- Keep credentials and sensitive information out of version control.

The presence of configuration and security files does not, by itself, prove that every integration or security workflow is complete.

## Progressive Web App

The repository includes PWA-related initialization, installation UI, online-status handling, and PWA installation hooks.

These components provide a foundation for an app-like web experience. Actual installability, offline functionality, caching, and synchronization depend on the implemented manifest, service worker, and runtime behavior.

## Bilingual Support

The repository includes `src/i18n/translations.ts`, which provides a foundation for translated interface content.

The supported languages, translation completeness, and language-switching behavior should be confirmed in the implementation.

## Security

Security is important when managing business ledgers, expenses, invoices, inventory records, and payroll information.

The repository includes `security_spec.md` and `firestore.rules.test.ts` for security-related documentation and testing.

Recommended checks include:

- Authentication and authorization.
- Database access restrictions.
- Input validation and data integrity.
- Protection of API keys and configuration secrets.
- Backup and recovery testing.
- Verification of access to sensitive payroll and financial records.

## Future Development

Potential areas for further development include:

- Detailed financial summaries and reports.
- Advanced sales and expense analytics.
- Export to CSV, Excel, and PDF.
- Customer and supplier payment reminders.
- Improved backup and recovery workflows.
- Enhanced mobile and offline usability.
- Additional language support.
- Expanded automated tests and security validation.

These are potential enhancements, not claims about features already implemented.

## Contributing

Contributions that improve usability, reliability, accessibility, testing, and security are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement and test your changes.
4. Submit a pull request with a clear explanation.

## License

No license has been specified in this README. Add a `LICENSE` file to clarify the terms under which others may use, modify, and distribute the project.

## Disclaimer

Digital Khatta is a software project for digital bookkeeping and business accounting. Verify financial calculations, record integrity, access controls, and backup procedures before relying on the application for business-critical operations.

---

**Digital Khatta — Simplifying Business Accounting Through Digital Bookkeeping.**
