import type { Metadata } from "next";
export const metadata:Metadata={title:"Prospecto — seu estúdio de sites",description:"Clientes, materiais, páginas e valores no mesmo espaço da equipe."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
