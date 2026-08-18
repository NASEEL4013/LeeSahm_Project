import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar" aria-label="주요 메뉴">
      <NavLink className="brand" to="/">LEE SAHM</NavLink>
      <div className="nav-links">
        <NavLink to="/about">Artist</NavLink>
        <NavLink to="/gallery">Works</NavLink>
        <NavLink className="compose-link" to="/compose">Compose</NavLink>
      </div>
    </nav>
  )
}
