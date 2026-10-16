// Small provenance tag: REAL, EXAMPLE or STAND-IN. The footnote explains all three.
export default function Tag({ kind }) {
  return <span className={`tag tag-${kind.toLowerCase()}`}>{kind}</span>;
}
