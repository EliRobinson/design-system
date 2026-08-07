'use client';

import { Rating } from '@elirobinson/react/components/molecules/Rating';

export default function Basic() {
  return (
    <div className="demo-col">
      <div className="demo-row">
        <span>Weeknight Pasta</span>
        <Rating value={4} />
      </div>
      <div className="demo-row">
        <span>U10 Practice Plan</span>
        <Rating value={5} />
      </div>
      <div className="demo-row">
        <span>Sheet-Pan Dinners</span>
        <Rating value={3} />
      </div>
    </div>
  );
}
