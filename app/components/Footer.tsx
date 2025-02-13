import Link from "next/link"
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react"

export default function Footer() {
  return (
    <footer className="w-full py-6 bg-gray-100 dark:bg-gray-800">
      <div className="container px-4 md:px-6">
        <div className="mt-8 flex justify-between items-center">
        <p>&copy; <span id="year"></span> wwww.stefanmarchitan.ro All rights reserved.</p>

        <script>
            document.getElementById("year").textContent = new Date().getFullYear();
        </script>

          <div className="flex space-x-4">
            <Link href="#" aria-label="Facebook">
              <Facebook className="h-6 w-6" />
            </Link>
            <Link href="#" aria-label="Twitter">
              <Twitter className="h-6 w-6" />
            </Link>
            <Link href="#" aria-label="Instagram">
              <Instagram className="h-6 w-6" />
            </Link>
            <Link href="#" aria-label="LinkedIn">
              <Linkedin className="h-6 w-6" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

