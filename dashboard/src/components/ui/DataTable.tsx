import { Children, createContext, isValidElement, useContext } from "react";
import type { CSSProperties, ReactNode } from "react";

import { Icon } from "../icons";
import "./DataTable.css";

type Align = "right" | "center";
type SortDirection = "asc" | "desc";

const AlignContext = createContext<Record<number, Align>>({});

/** Shared admin data grid. Columns are a CSS grid template so existing pages keep
 * their widths, while every table gets the same roles, header style, hover and
 * selection states. Cells are wrapped automatically, so a row's children are
 * just its cell contents in column order. */
export function DataTable({
  label,
  columns,
  minWidth,
  align = {},
  stickyActions = false,
  maxHeight,
  children,
}: {
  label: string;
  columns: string;
  minWidth?: number;
  align?: Record<number, Align>;
  /** Pin the last column (row actions) to the right edge while the table scrolls sideways. */
  stickyActions?: boolean;
  /** Give the table its own vertical scroll with a sticky header (long, paged lists). */
  maxHeight?: string;
  children: ReactNode;
}) {
  return (
    <AlignContext.Provider value={align}>
      <div
        className={`dt-scroll${maxHeight ? " has-sticky-head" : ""}`}
        role="region"
        aria-label={`${label} table`}
        tabIndex={0}
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
      >
        <div
          className={`dt${stickyActions ? " has-sticky-actions" : ""}`}
          role="table"
          aria-label={label}
          style={{ "--dt-cols": columns, minWidth } as CSSProperties}
        >
          {children}
        </div>
      </div>
    </AlignContext.Provider>
  );
}

function alignClass(align: Record<number, Align>, index: number) {
  const a = align[index];
  return a ? ` is-${a}` : "";
}

export function DataTableHead({ children }: { children: ReactNode }) {
  const align = useContext(AlignContext);
  return (
    <div role="rowgroup" className="dt-head">
      <div role="row" className="dt-row">
        {Children.map(children, (child, i) => {
          const sort = isValidElement<{ direction?: SortDirection | null }>(child) && child.type === SortHeader
            ? child.props.direction
            : undefined;
          return (
            <div
              role="columnheader"
              className={`dt-cell${alignClass(align, i)}`}
              aria-sort={sort === undefined ? undefined : sort === null ? "none" : sort === "asc" ? "ascending" : "descending"}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <div role="rowgroup">{children}</div>;
}

export function DataTableRow({
  children,
  selected,
  muted,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  muted?: boolean;
  onClick?: () => void;
}) {
  const align = useContext(AlignContext);
  return (
    <div
      role="row"
      aria-selected={selected}
      className={`dt-row dt-body-row${selected ? " is-selected" : ""}${muted ? " is-muted" : ""}${onClick ? " is-clickable" : ""}`}
      onClick={onClick}
    >
      {Children.map(children, (child, i) =>
        child === null || child === undefined || child === false ? (
          <div role="cell" className="dt-cell" />
        ) : (
          <div role="cell" className={`dt-cell${alignClass(align, i)}`}>
            {child}
          </div>
        ),
      )}
    </div>
  );
}

export function DataTableEmpty({ children }: { children: ReactNode }) {
  return (
    <div role="row" className="dt-row">
      <div role="cell" className="dt-empty">
        {children}
      </div>
    </div>
  );
}

/** Header button for a sortable column. `direction` is null when another column
 * is sorted — the header wrapper reads it to set aria-sort. */
export function SortHeader({
  label,
  direction,
  onSort,
}: {
  label: string;
  direction: SortDirection | null;
  onSort: () => void;
}) {
  const active = direction !== null;
  return (
    <button type="button" className={`dt-sort${active ? " is-active" : ""}`} onClick={onSort}>
      {label}
      <Icon.chevron
        size={12}
        aria-hidden="true"
        className="dt-sort-icon"
        style={{ transform: `rotate(${direction === "asc" ? -90 : 90}deg)` }}
      />
    </button>
  );
}

/** Row and header checkbox with a 24px hit area. */
export function DataTableCheckbox({
  label,
  checked,
  indeterminate,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="dt-check" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate && !checked;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
