import type { Metadata } from "next";
import "./globals.css";
import { AmplifyProvider } from "@/components/providers/amplify-provider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/toaster";

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
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AmplifyProvider>
            {children}
            <Toaster />
          </AmplifyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
