export function WaveField() {
  return (
    <div className="page-waves" aria-hidden="true">
      <div className="login-wave-layer login-wave-layer--back">
        <Wave />
        <Wave />
      </div>
      <div className="login-wave-layer login-wave-layer--front">
        <Wave />
        <Wave />
      </div>
    </div>
  );
}

function Wave() {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,64 C200,20 400,108 600,64 C800,20 1000,108 1200,64 L1200,120 L0,120 Z" />
    </svg>
  );
}
