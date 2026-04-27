import { Button, Card, Input } from '@elirobinson/react';
import '@elirobinson/react/styles.css';

function App() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-10)' }}>
      <h1 className="t-h2">Miltinson Design System Starter</h1>
      <p className="t-body">Built with token-driven defaults and accessible components.</p>

      <Card>
        <Input label="Project name" placeholder="New platform feature" />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button>Continue</Button>
        </div>
      </Card>
    </main>
  );
}

void App;
