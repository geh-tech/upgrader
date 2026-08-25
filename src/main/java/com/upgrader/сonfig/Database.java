package com.upgrader.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.upgrader.models.Item;

import java.io.InputStream;
import java.sql.*;
import java.util.List;

public class Database {
    private static final String DB_URL = "jdbc:sqlite:database.db";
    private static Connection connection;

    public static Connection getConnection() throws SQLException {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(DB_URL);
        }
        return connection;
    }

    public static void init() {
        try (Statement stmt = getConnection().createStatement()) {
            stmt.execute("CREATE TABLE IF NOT EXISTS users (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "nickname TEXT UNIQUE NOT NULL," +
                    "password TEXT NOT NULL," +
                    "level INTEGER DEFAULT 1," +
                    "coins INTEGER DEFAULT 0," +
                    "exp INTEGER DEFAULT 0," +
                    "max_hp INTEGER DEFAULT 100," +
                    "current_hp INTEGER DEFAULT 100)");

            stmt.execute("CREATE TABLE IF NOT EXISTS items (" +
                    "id INTEGER PRIMARY KEY," +
                    "name TEXT NOT NULL," +
                    "slot TEXT NOT NULL," +
                    "armor INTEGER DEFAULT 0," +
                    "damage INTEGER DEFAULT 0," +
                    "rarity TEXT," +
                    "base_price INTEGER DEFAULT 0," +
                    "texture_url TEXT)");

            stmt.execute("CREATE TABLE IF NOT EXISTS inventory (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "user_id INTEGER NOT NULL," +
                    "item_id INTEGER NOT NULL," +
                    "upgrade_level INTEGER DEFAULT 0," +
                    "is_equipped BOOLEAN DEFAULT 0," +
                    "FOREIGN KEY(user_id) REFERENCES users(id)," +
                    "FOREIGN KEY(item_id) REFERENCES items(id))");

            stmt.execute("CREATE TABLE IF NOT EXISTS battles (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "type TEXT," +
                    "status TEXT," +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");

            stmt.execute("CREATE TABLE IF NOT EXISTS battle_participants (" +
                    "battle_id INTEGER," +
                    "user_id INTEGER," +
                    "team INTEGER DEFAULT 0," +
                    "status TEXT," +
                    "PRIMARY KEY(battle_id, user_id)," +
                    "FOREIGN KEY(battle_id) REFERENCES battles(id)," +
                    "FOREIGN KEY(user_id) REFERENCES users(id))");
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public static void loadItemsFromJson() {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream is = Database.class.getClassLoader().getResourceAsStream("items.json")) {
            if (is == null) {
                System.err.println("items.json не найден в resources!");
                return;
            }
            List<Item> items = mapper.readValue(is, mapper.getTypeFactory().constructCollectionType(List.class, Item.class));
            try (Connection conn = getConnection()) {
                for (Item item : items) {
                    PreparedStatement check = conn.prepareStatement("SELECT id FROM items WHERE id = ?");
                    check.setInt(1, item.id);
                    ResultSet rs = check.executeQuery();
                    if (!rs.next()) {
                        PreparedStatement insert = conn.prepareStatement(
                                "INSERT INTO items (id, name, slot, armor, damage, rarity, base_price, texture_url) " +
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                        insert.setInt(1, item.id);
                        insert.setString(2, item.name);
                        insert.setString(3, item.slot);
                        insert.setInt(4, item.armor);
                        insert.setInt(5, item.damage);
                        insert.setString(6, item.rarity);
                        insert.setInt(7, item.basePrice);
                        insert.setString(8, item.textureUrl);
                        insert.executeUpdate();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}