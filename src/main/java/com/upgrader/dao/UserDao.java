package com.upgrader.dao;

import com.upgrader.config.Database;
import com.upgrader.models.User;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class UserDao {
    public static boolean register(User user) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "INSERT INTO users (nickname, password, level, coins, exp, max_hp, current_hp) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
            stmt.setString(1, user.getNickname());
            stmt.setString(2, user.getPassword());
            stmt.setInt(3, user.getLevel());
            stmt.setInt(4, user.getCoins());
            stmt.setInt(5, user.getExp());
            stmt.setInt(6, user.getMaxHp());
            stmt.setInt(7, user.getCurrentHp());
            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static User login(String nickname, String password) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE nickname = ? AND password = ?")) {
            stmt.setString(1, nickname);
            stmt.setString(2, password);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                User user = new User();
                user.setId(rs.getInt("id"));
                user.setNickname(rs.getString("nickname"));
                user.setPassword(rs.getString("password"));
                user.setLevel(rs.getInt("level"));
                user.setCoins(rs.getInt("coins"));
                user.setExp(rs.getInt("exp"));
                user.setMaxHp(rs.getInt("max_hp"));
                user.setCurrentHp(rs.getInt("current_hp"));
                return user;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }

    public static User getUserById(int id) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE id = ?")) {
            stmt.setInt(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                User user = new User();
                user.setId(rs.getInt("id"));
                user.setNickname(rs.getString("nickname"));
                user.setPassword(rs.getString("password"));
                user.setLevel(rs.getInt("level"));
                user.setCoins(rs.getInt("coins"));
                user.setExp(rs.getInt("exp"));
                user.setMaxHp(rs.getInt("max_hp"));
                user.setCurrentHp(rs.getInt("current_hp"));
                return user;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }

    public static void updateUser(User user) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "UPDATE users SET level=?, coins=?, exp=?, max_hp=?, current_hp=? WHERE id=?")) {
            stmt.setInt(1, user.getLevel());
            stmt.setInt(2, user.getCoins());
            stmt.setInt(3, user.getExp());
            stmt.setInt(4, user.getMaxHp());
            stmt.setInt(5, user.getCurrentHp());
            stmt.setInt(6, user.getId());
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static List<User> getTopPlayers(int limit) {
        List<User> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users ORDER BY level DESC, exp DESC LIMIT ?")) {
            stmt.setInt(1, limit);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                User user = new User();
                user.setId(rs.getInt("id"));
                user.setNickname(rs.getString("nickname"));
                user.setLevel(rs.getInt("level"));
                user.setCoins(rs.getInt("coins"));
                user.setExp(rs.getInt("exp"));
                user.setMaxHp(rs.getInt("max_hp"));
                user.setCurrentHp(rs.getInt("current_hp"));
                list.add(user);
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return list;
    }
}