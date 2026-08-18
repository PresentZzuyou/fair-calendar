import type {Metadata} from "next"; import "./globals.css";
export const metadata:Metadata={title:"이모팁스 콘텐츠 페어 캘린더",description:"이모팁스가 모은 전국 일러스트, 캐릭터, IP, 웹툰 콘텐츠 페어 일정을 한눈에 확인하세요."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
