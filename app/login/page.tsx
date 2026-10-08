import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card-header">
          <span className="brand-mark login-brand-mark" role="img" aria-label="Fishy-Fishy" />
          <div>
            <h1 className="login-brand-name">Fishy-Fishy</h1>
            <p className="login-brand-tagline">Seed logistics</p>
          </div>
        </div>
        <div className="login-card-body">
          <p className="login-card-subtitle">Sign in to your workspace</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
