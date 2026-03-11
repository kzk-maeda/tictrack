import type { Metadata } from "next";
import "./globals.css";
import { AmplifyProvider } from "@/components/providers/amplify-provider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/toaster";
import { DemoModeProviderWrapper } from "@/components/providers/demo-mode-provider-wrapper";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const messages: any = await getMessages();

  return {
    title: messages.common.appName as string,
    description: messages.manifest.description as string,
    manifest: "/manifest.json",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DemoModeProviderWrapper>
            <AmplifyProvider>
              <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
                {children}
              </div>
              <Toaster />
            </AmplifyProvider>
          </DemoModeProviderWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
