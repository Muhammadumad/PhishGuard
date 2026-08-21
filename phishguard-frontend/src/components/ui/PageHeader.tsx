export default function PageHeader({
  title,
  subtitle,
  right = null,
  chips = null,
}) {
  return (
    <div className="pg-page-header-wrap">
      <div className="pg-page-header-main">
        {title ? <h1 className="pg-page-title">{title}</h1> : null}
        {subtitle ? <p className="pg-page-subtitle">{subtitle}</p> : null}
        {chips ? <div className="pg-page-chip-row">{chips}</div> : null}
      </div>
      {right ? <div className="pg-page-header-actions">{right}</div> : null}
    </div>
  );
}
