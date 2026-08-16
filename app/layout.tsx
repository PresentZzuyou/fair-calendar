import type {Metadata} from "next"; import "./globals.css";
export const metadata:Metadata={title:"콘텐츠 페어 캘린더 — 국내 콘텐츠 행사 모아보기",description:"전국에서 열리는 일러스트, 캐릭터, IP, 웹툰 콘텐츠 페어 일정을 한눈에 확인하세요."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
