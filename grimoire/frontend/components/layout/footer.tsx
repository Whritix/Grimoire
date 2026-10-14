import Link from "next/link"

export function Footer() {
  return (
    <footer className="w-full bg-[#250d06] border-t border-[#3d180f] py-4 px-6 md:px-12 text-[#d5c3b8]">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs md:text-sm">
        <div className="flex items-center gap-2 tracking-wide select-none">
          <span className="text-[#e3935c]">♡</span>
          <span>Built for your growth</span>
          <span className="text-[#e3935c]">♡</span>
        </div>
        <div className="flex items-center gap-8 text-xs md:text-sm font-normal">
          <Link href="/about" className="hover:text-[#ffffff] transition-colors">
            About
          </Link>
          <Link href="/help" className="hover:text-[#ffffff] transition-colors">
            Help
          </Link>
          <Link href="/privacy" className="hover:text-[#ffffff] transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  )
}
