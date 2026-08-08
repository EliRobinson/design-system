'use client';

import { useState } from 'react';

import { SearchField } from '@elirobinson/react/components/molecules/SearchField';

const RECIPES = ['Weeknight Pasta', 'Sheet-Pan Chicken', 'Ten-Minute Tacos', 'Fridge Soup'];

export default function Controlled() {
  const [query, setQuery] = useState('');
  const results = RECIPES.filter((recipe) => recipe.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="demo-col">
      <SearchField aria-label="Search recipes" value={query} onValueChange={setQuery} />
      <ul>
        {results.length > 0 ? (
          results.map((recipe) => <li key={recipe}>{recipe}</li>)
        ) : (
          <li>No recipes match &quot;{query}&quot;.</li>
        )}
      </ul>
    </div>
  );
}
