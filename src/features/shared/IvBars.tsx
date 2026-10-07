export function IvBars({
  atk,
  def,
  sta,
  onChange,
}: {
  atk: number;
  def: number;
  sta: number;
  onChange: (next: { atk: number; def: number; sta: number }) => void;
}) {
  return (
    <div className="iv-bars">
      <IvBar label="攻撃" value={atk} onChange={(value) => onChange({ atk: value, def, sta })} />
      <IvBar label="防御" value={def} onChange={(value) => onChange({ atk, def: value, sta })} />
      <IvBar label="HP" value={sta} onChange={(value) => onChange({ atk, def, sta: value })} />
    </div>
  );
}

function IvBar({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="iv-bar-block">
      <div className="iv-bar-label">
        <span>{label}</span>
        <strong className="num">{value}</strong>
      </div>
      <div className="iv-bar" role="group" aria-label={`${label} ${value}`}>
        {Array.from({ length: 16 }, (_, index) => {
          const filled = index <= value;
          const tone = !filled ? "" : index === 0 ? " is-zero" : " is-fill";
          return (
            <button
              key={index}
              type="button"
              className={`iv-bar-cell${tone}`}
              aria-label={`${label} ${index}`}
              aria-pressed={index === value}
              onClick={() => onChange(index)}
            />
          );
        })}
      </div>
    </div>
  );
}
