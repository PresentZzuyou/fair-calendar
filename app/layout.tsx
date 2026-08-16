import type {Metadata} from "next"; import "./globals.css";
export const metadata:Metadata={title:"페어캘린더 — 캐릭터·일러스트 페어 모아보기",description:"전국에서 열리는 캐릭터, 일러스트, 굿즈 페어 일정을 한눈에 확인하세요."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
