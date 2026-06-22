import "./globals.css";

export const metadata = {
  title: "MyTodoList",
  description: "極簡待辦清單 — 每個清單就是一個 Markdown 檔",
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
