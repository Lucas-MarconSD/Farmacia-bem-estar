const db = require('../database/sqlite');

class UserRepository {
  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  create(username, passwordHash, role = 'admin') {
    return db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, passwordHash, role);
  }

  updatePassword(id, passwordHash) {
    return db.prepare('UPDATE users SET password = ? WHERE id = ?').run(passwordHash, id);
  }
}

module.exports = new UserRepository();
