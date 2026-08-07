export function DoDont({ do: doItems, dont }: { do: string[]; dont: string[] }) {
  return (
    <div className="do-dont">
      <div className="do-dont__col do-dont__col--do">
        <p className="do-dont__label">Do</p>
        <ul>
          {doItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="do-dont__col do-dont__col--dont">
        <p className="do-dont__label">Don&apos;t</p>
        <ul>
          {dont.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
