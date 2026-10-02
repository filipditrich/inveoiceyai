import { SignInForm } from "../../../../../app/sign-in/sign-in-form";
export default function Page() {
  return <SignInForm next="/callback" providers={["google", "github"]} />;
}
