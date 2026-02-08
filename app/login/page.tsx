import { isLoggedIn } from "@/lib/tataplay"
import { redirect } from "next/navigation"
import LoginForm from "@/components/login-form"

export default async function LoginPage() {
  const loggedIn = await isLoggedIn()
  if (loggedIn) {
    redirect("/")
  }

  return <LoginForm />
}
