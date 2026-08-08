'use client';

import { useState } from 'react';

import { Chip } from '@elirobinson/react/components/molecules/Chip';

export default function Removable() {
  const [tags, setTags] = useState(['Practice plans', 'U10', 'Soccer', 'Fall season']);

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((item) => item !== tag));
  };

  return (
    <div className="demo-row">
      {tags.length === 0 ? (
        <p>No filters applied.</p>
      ) : (
        tags.map((tag) => (
          <Chip key={tag} onRemove={() => removeTag(tag)}>
            {tag}
          </Chip>
        ))
      )}
    </div>
  );
}
