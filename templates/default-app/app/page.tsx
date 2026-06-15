import { Button } from '@elirobinson/react/components/Button';
import { Card } from '@elirobinson/react/components/Card';
import { Input } from '@elirobinson/react/components/Input';

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <h1 className="t-h2">EliRobinson Next.js Starter</h1>
        <p className="t-body">
          Ship fast with token-driven styles and accessible design-system primitives.
        </p>
      </section>

      <Card>
        <Input label="Project name" placeholder="Your new product" />
        <div className="actions">
          <Button>Start building</Button>
        </div>
      </Card>
    </main>
  );
}
