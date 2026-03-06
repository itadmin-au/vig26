import { PublicNavbar } from "@/components/public-navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PublicNavbar />
            <main className="pt-16">
                {children}
            </main>
        </>
    );
}