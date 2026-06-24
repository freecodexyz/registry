import { Field, Input, Select } from '@freecodexyz/ui'
import type { Sort } from './repositoryTypes'

type RepositoryFiltersProps = {
  q: string;
  sort: Sort;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

export function RepositoryFilters({ q, sort, onSearchChange, onSortChange }: RepositoryFiltersProps) {
  return (
    <section className="registry-controls" aria-label="Repository filters">
      <Field label="Search" className="registry-search">
        <Input
          value={q}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="repo, owner, language, address..."
          type="search"
        />
      </Field>
      <Field label="Sort">
        <Select value={sort} onChange={(event) => onSortChange(event.target.value)}>
          <option value="registered_at_desc">Newest first</option>
          <option value="registered_at_asc">Oldest first</option>
          <option value="stars_desc">Most stars</option>
        </Select>
      </Field>
    </section>
  )
}
