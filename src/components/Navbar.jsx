import { NavLink } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'

export default function Navbar() {
  const { user } = useAuth()
  return (
    <nav className="navbar" aria-label="주요 메뉴">
      <NavLink className="brand" to="/">LEE SAHM</NavLink>
      <div className="nav-links">
        <NavLink to="/about">Artist</NavLink>
        <NavLink to="/gallery">Works</NavLink>
        <NavLink to="/board">COMBI</NavLink>
        <NavLink className="account-link" to="/login">{user ? 'Account' : 'Login'}</NavLink>
        <NavLink className="compose-link" to="/compose">Compose</NavLink>
      </div>
    </nav>
  )
}
