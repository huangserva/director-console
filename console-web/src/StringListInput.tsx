import { addItem, removeItem, setItem } from "./lib/string-list";

// Controlled add/remove list of text rows (selling points, optional media paths).
export function StringListInput(props: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { label, values, onChange, placeholder, disabled } = props;
  return (
    <div className="string-list">
      <span className="string-list-label">{label}</span>
      {values.map((value, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="string-list-row" key={i}>
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(setItem(values, i, e.target.value))}
          />
          <button
            type="button"
            className="clear-btn"
            title="删除"
            disabled={disabled}
            onClick={() => onChange(removeItem(values, i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="add-row-btn" disabled={disabled} onClick={() => onChange(addItem(values))}>
        + 添加
      </button>
    </div>
  );
}
