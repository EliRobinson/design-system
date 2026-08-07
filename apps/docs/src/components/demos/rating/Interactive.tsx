'use client';

import { useState } from 'react';

import { Rating } from '@elirobinson/react/components/molecules/Rating';

export default function Interactive() {
  const [value, setValue] = useState(0);

  return (
    <div className="demo-col">
      <Rating value={value} onValueChange={setValue} />
      <p>
        {value > 0 ? `You rated this recipe ${value} out of 5.` : 'Tap a star to rate this recipe.'}
      </p>
    </div>
  );
}
