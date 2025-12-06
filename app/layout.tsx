import "./globals.css";

export const metadata = {
  title: "Trading CSV Analyzer",
  description: "Prosty analizator transakcji z CSV"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {children}
      </body>
    </html>
  );
}
