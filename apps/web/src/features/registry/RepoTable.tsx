import type { KeyboardEvent, MouseEvent } from 'react'
import githubLogoUrl from '../../assets/GitHub_Invertocat_Black.svg'
import { Notice, Table, TableCell, TableHeader, TableViewport } from '@freecodexyz/ui'
import { explorerAddressUrl } from '../../shared/explorers'
import type { Repo } from './repositoryTypes'

const COMPACT_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function formatAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatRegisteredAt(timestamp: number) {
  return COMPACT_DATE.format(new Date(timestamp * 1000))
}

function isInteractiveRowTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a, button, input, select, textarea'))
}

export function RepoTable({ repos, onSelectRepo, emptyMessage }: { repos: Repo[]; onSelectRepo: (repo: Repo) => void; emptyMessage: string }) {
  if (repos.length === 0) return <Notice>{emptyMessage}</Notice>

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, repo: Repo) {
    if (isInteractiveRowTarget(event.target)) return
    onSelectRepo(repo)
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, repo: Repo) {
    if (isInteractiveRowTarget(event.target)) return
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onSelectRepo(repo)
  }

  return (
    <TableViewport>
      <Table className="repositories-table">
        <thead>
          <tr>
            <TableHeader>GITHUB</TableHeader>
            <TableHeader>language</TableHeader>
            <TableHeader numeric>stars</TableHeader>
            <TableHeader>address</TableHeader>
            <TableHeader>owner</TableHeader>
            <TableHeader>registered_at</TableHeader>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => {
            const github = repo.github === 'not found' ? null : repo.github
            const ownerLabel = repo.githubOwnerUsername === 'not found' ? String(repo.githubOwnerId) : repo.githubOwnerUsername
            const registeredDate = new Date(repo.registeredAt * 1000)

            return (
              <tr
                key={repo.repoId}
                className="repo-table-row"
                tabIndex={0}
                role="button"
                aria-label={`Open details for ${github?.fullName ?? repo.repoId}`}
                onClick={(event) => handleRowClick(event, repo)}
                onKeyDown={(event) => handleRowKeyDown(event, repo)}
              >
                <TableCell>
                  {github ? (
                    <a className="repo-github-link fcf-link" href={github.htmlUrl} target="_blank" rel="noreferrer">
                      <img className="repo-github-icon" src={githubLogoUrl} alt="" />
                      {github.fullName}
                    </a>
                  ) : (
                    'not found'
                  )}
                </TableCell>
                <TableCell mono>{github?.language ?? '-'}</TableCell>
                <TableCell numeric>
                  {github ? (
                    <span className="repo-stars">
                      <svg className="repo-star-icon" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 1.15 10.1 5.4l4.7.68-3.4 3.31.8 4.68L8 11.86l-4.2 2.21.8-4.68-3.4-3.31 4.7-.68L8 1.15Z" />
                      </svg>
                      {github.stars.toLocaleString()}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell mono>
                  <a className="repo-address fcf-link" href={explorerAddressUrl(repo.chainId, repo.registrant)} target="_blank" rel="noreferrer">
                    {formatAddress(repo.registrant)}
                  </a>
                </TableCell>
                <TableCell mono>
                  {repo.githubOwnerUsername === 'not found' ? ownerLabel : (
                    <a className="repo-owner-link fcf-link" href={`https://github.com/${repo.githubOwnerUsername}`} target="_blank" rel="noreferrer">
                      {ownerLabel}
                    </a>
                  )}
                </TableCell>
                <TableCell mono>
                  <time className="repo-date" dateTime={registeredDate.toISOString()}>{formatRegisteredAt(repo.registeredAt)}</time>
                </TableCell>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableViewport>
  )
}
