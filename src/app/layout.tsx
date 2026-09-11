import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HappyCoin Client Care Check-in",
  description: "Monthly Client Care Check-in for HappyCoin customers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6">
          <header className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white">HC</div>
            <div><p className="text-sm font-semibold text-slate-900">HappyCoin</p><p className="text-xs text-slate-500">Client Care Check-in</p></div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="mt-10 text-center text-xs text-slate-400">© {new Date().getFullYear()} HappyCoin. Your information is kept confidential.</footer>
        </div>
      </body>
    </html>
  );
}
