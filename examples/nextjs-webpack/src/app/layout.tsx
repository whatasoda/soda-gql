import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "soda-gql Next.js Example",
  description: "Example Next.js app using soda-gql webpack plugin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
