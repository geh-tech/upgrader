import com.fasterxml.jackson.databind.ObjectMapper;
import org.sqlite.JDBC;

import java.io.InputStream;
import java.sql.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import static spark.Spark.*;

public class App {

    // ========== МОДЕЛИ (вложенные классы) ==========

    public static class User {
        public int id;
        public String nickname;
        public String password;
        public int level = 1;
        public int coins = 0;
        public int exp = 0;
        public int maxHp = 100;
        public int currentHp = 100;
    }

    public static class Item {
        public int id;
        public String name;
        public String slot;
        public int armor;
        public int damage;
        public String rarity;
        public int basePrice;
        public String textureUrl;
    }

    public static class InventoryItem {
        public int id;
        public int userId;
        public int itemId;
        public int upgradeLevel;
        public boolean equipped;
    }

    public static class Battle {
        public int id;
        public String type;
        public String status;
        public Timestamp createdAt;
    }

    // ========== БАЗА ДАННЫХ ==========

    private static final String DB_URL = "jdbc:sqlite:database.db";
    private static Connection connection;

    private static Connection getConnection() throws SQLException {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(DB_URL);
        }
        return connection;
    }

    public static void initDatabase() {
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
        try (InputStream is = App.class.getClassLoader().getResourceAsStream("items.json")) {
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

    // ========== DAO (статические методы) ==========

    public static class UserDao {
        public static boolean register(User user) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement(
                         "INSERT INTO users (nickname, password, level, coins, exp, max_hp, current_hp) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
                stmt.setString(1, user.nickname);
                stmt.setString(2, user.password);
                stmt.setInt(3, user.level);
                stmt.setInt(4, user.coins);
                stmt.setInt(5, user.exp);
                stmt.setInt(6, user.maxHp);
                stmt.setInt(7, user.currentHp);
                stmt.executeUpdate();
                return true;
            } catch (SQLException e) {
                e.printStackTrace();
                return false;
            }
        }

        public static User login(String nickname, String password) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE nickname = ? AND password = ?")) {
                stmt.setString(1, nickname);
                stmt.setString(2, password);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    User user = new User();
                    user.id = rs.getInt("id");
                    user.nickname = rs.getString("nickname");
                    user.password = rs.getString("password");
                    user.level = rs.getInt("level");
                    user.coins = rs.getInt("coins");
                    user.exp = rs.getInt("exp");
                    user.maxHp = rs.getInt("max_hp");
                    user.currentHp = rs.getInt("current_hp");
                    return user;
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return null;
        }

        public static User getUserById(int id) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE id = ?")) {
                stmt.setInt(1, id);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    User user = new User();
                    user.id = rs.getInt("id");
                    user.nickname = rs.getString("nickname");
                    user.password = rs.getString("password");
                    user.level = rs.getInt("level");
                    user.coins = rs.getInt("coins");
                    user.exp = rs.getInt("exp");
                    user.maxHp = rs.getInt("max_hp");
                    user.currentHp = rs.getInt("current_hp");
                    return user;
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return null;
        }

        public static void updateUser(User user) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement(
                         "UPDATE users SET level=?, coins=?, exp=?, max_hp=?, current_hp=? WHERE id=?")) {
                stmt.setInt(1, user.level);
                stmt.setInt(2, user.coins);
                stmt.setInt(3, user.exp);
                stmt.setInt(4, user.maxHp);
                stmt.setInt(5, user.currentHp);
                stmt.setInt(6, user.id);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }

        public static List<User> getTopPlayers(int limit) {
            List<User> list = new ArrayList<>();
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users ORDER BY level DESC, exp DESC LIMIT ?")) {
                stmt.setInt(1, limit);
                ResultSet rs = stmt.executeQuery();
                while (rs.next()) {
                    User user = new User();
                    user.id = rs.getInt("id");
                    user.nickname = rs.getString("nickname");
                    user.level = rs.getInt("level");
                    user.coins = rs.getInt("coins");
                    user.exp = rs.getInt("exp");
                    user.maxHp = rs.getInt("max_hp");
                    user.currentHp = rs.getInt("current_hp");
                    list.add(user);
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return list;
        }
    }

    public static class ItemDao {
        public static List<Item> getAllItems() {
            List<Item> list = new ArrayList<>();
            try (Connection conn = getConnection();
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM items")) {
                while (rs.next()) {
                    Item item = new Item();
                    item.id = rs.getInt("id");
                    item.name = rs.getString("name");
                    item.slot = rs.getString("slot");
                    item.armor = rs.getInt("armor");
                    item.damage = rs.getInt("damage");
                    item.rarity = rs.getString("rarity");
                    item.basePrice = rs.getInt("base_price");
                    item.textureUrl = rs.getString("texture_url");
                    list.add(item);
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return list;
        }

        public static Item getItemById(int id) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM items WHERE id = ?")) {
                stmt.setInt(1, id);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    Item item = new Item();
                    item.id = rs.getInt("id");
                    item.name = rs.getString("name");
                    item.slot = rs.getString("slot");
                    item.armor = rs.getInt("armor");
                    item.damage = rs.getInt("damage");
                    item.rarity = rs.getString("rarity");
                    item.basePrice = rs.getInt("base_price");
                    item.textureUrl = rs.getString("texture_url");
                    return item;
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return null;
        }
    }

    public static class InventoryDao {
        public static List<InventoryItem> getInventory(int userId) {
            List<InventoryItem> list = new ArrayList<>();
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM inventory WHERE user_id = ?")) {
                stmt.setInt(1, userId);
                ResultSet rs = stmt.executeQuery();
                while (rs.next()) {
                    InventoryItem ii = new InventoryItem();
                    ii.id = rs.getInt("id");
                    ii.userId = rs.getInt("user_id");
                    ii.itemId = rs.getInt("item_id");
                    ii.upgradeLevel = rs.getInt("upgrade_level");
                    ii.equipped = rs.getBoolean("is_equipped");
                    list.add(ii);
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return list;
        }

        public static InventoryItem getInventoryItemById(int invId) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM inventory WHERE id = ?")) {
                stmt.setInt(1, invId);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    InventoryItem ii = new InventoryItem();
                    ii.id = rs.getInt("id");
                    ii.userId = rs.getInt("user_id");
                    ii.itemId = rs.getInt("item_id");
                    ii.upgradeLevel = rs.getInt("upgrade_level");
                    ii.equipped = rs.getBoolean("is_equipped");
                    return ii;
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return null;
        }

        public static void addItem(int userId, int itemId, int level) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement(
                         "INSERT INTO inventory (user_id, item_id, upgrade_level, is_equipped) VALUES (?, ?, ?, 0)")) {
                stmt.setInt(1, userId);
                stmt.setInt(2, itemId);
                stmt.setInt(3, level);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }

        public static void deleteItem(int invId) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("DELETE FROM inventory WHERE id = ?")) {
                stmt.setInt(1, invId);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }

        public static void updateEquipped(int invId, boolean equipped) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("UPDATE inventory SET is_equipped = ? WHERE id = ?")) {
                stmt.setBoolean(1, equipped);
                stmt.setInt(2, invId);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }

        public static void upgradeLevel(int invId) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("UPDATE inventory SET upgrade_level = upgrade_level + 1 WHERE id = ?")) {
                stmt.setInt(1, invId);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }

        public static List<InventoryItem> getEquippedItems(int userId) {
            List<InventoryItem> list = new ArrayList<>();
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM inventory WHERE user_id = ? AND is_equipped = 1")) {
                stmt.setInt(1, userId);
                ResultSet rs = stmt.executeQuery();
                while (rs.next()) {
                    InventoryItem ii = new InventoryItem();
                    ii.id = rs.getInt("id");
                    ii.userId = rs.getInt("user_id");
                    ii.itemId = rs.getInt("item_id");
                    ii.upgradeLevel = rs.getInt("upgrade_level");
                    ii.equipped = true;
                    list.add(ii);
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return list;
        }
    }

    public static class BattleDao {
        public static int createBattle(String type, String status) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement(
                         "INSERT INTO battles (type, status) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS)) {
                stmt.setString(1, type);
                stmt.setString(2, status);
                stmt.executeUpdate();
                ResultSet rs = stmt.getGeneratedKeys();
                if (rs.next()) return rs.getInt(1);
            } catch (SQLException e) { e.printStackTrace(); }
            return -1;
        }

        public static void addParticipant(int battleId, int userId, int team, String status) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement(
                         "INSERT INTO battle_participants (battle_id, user_id, team, status) VALUES (?, ?, ?, ?)")) {
                stmt.setInt(1, battleId);
                stmt.setInt(2, userId);
                stmt.setInt(3, team);
                stmt.setString(4, status);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }

        public static void updateParticipantStatus(int battleId, int userId, String status) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement(
                         "UPDATE battle_participants SET status = ? WHERE battle_id = ? AND user_id = ?")) {
                stmt.setString(1, status);
                stmt.setInt(2, battleId);
                stmt.setInt(3, userId);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }

        public static Battle getBattle(int battleId) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT * FROM battles WHERE id = ?")) {
                stmt.setInt(1, battleId);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    Battle b = new Battle();
                    b.id = rs.getInt("id");
                    b.type = rs.getString("type");
                    b.status = rs.getString("status");
                    b.createdAt = rs.getTimestamp("created_at");
                    return b;
                }
            } catch (SQLException e) { e.printStackTrace(); }
            return null;
        }

        public static List<Integer> getParticipants(int battleId) {
            List<Integer> list = new ArrayList<>();
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("SELECT user_id FROM battle_participants WHERE battle_id = ?")) {
                stmt.setInt(1, battleId);
                ResultSet rs = stmt.executeQuery();
                while (rs.next()) list.add(rs.getInt("user_id"));
            } catch (SQLException e) { e.printStackTrace(); }
            return list;
        }

        public static void updateBattleStatus(int battleId, String status) {
            try (Connection conn = getConnection();
                 PreparedStatement stmt = conn.prepareStatement("UPDATE battles SET status = ? WHERE id = ?")) {
                stmt.setString(1, status);
                stmt.setInt(2, battleId);
                stmt.executeUpdate();
            } catch (SQLException e) { e.printStackTrace(); }
        }
    }

    // ========== СЕРВИСЫ ==========

    private static final Map<Integer, BattleState> battleStates = new ConcurrentHashMap<>();

    private static class BattleState {
        int battleId;
        List<Integer> userIds;
        Map<Integer, Integer> hp;
        int currentTurn;
        String status;
    }

    public static class GameService {
        public static List<InventoryItem> getFullInventory(int userId) {
            return InventoryDao.getInventory(userId);
        }

        public static void equipItem(int userId, int invId) {
            InventoryItem invItem = InventoryDao.getInventoryItemById(invId);
            if (invItem == null || invItem.userId != userId) return;

            Item item = ItemDao.getItemById(invItem.itemId);
            String slot = item.slot;

            List<InventoryItem> all = InventoryDao.getInventory(userId);
            for (InventoryItem other : all) {
                if (other.equipped) {
                    Item otherItem = ItemDao.getItemById(other.itemId);
                    if (otherItem.slot.equals(slot)) {
                        InventoryDao.updateEquipped(other.id, false);
                    }
                }
            }
            InventoryDao.updateEquipped(invId, true);
        }

        public static boolean upgradeItem(int userId, int invId, int chancePercent) {
            InventoryItem invItem = InventoryDao.getInventoryItemById(invId);
            if (invItem == null || invItem.userId != userId) return false;

            int roll = (int)(Math.random() * 100);
            if (roll < chancePercent) {
                InventoryDao.upgradeLevel(invId);
                return true;
            } else {
                InventoryDao.deleteItem(invId);
                return false;
            }
        }

        public static int createBattle(int userId, int opponentId) {
            int battleId = BattleDao.createBattle("1v1", "active");
            BattleDao.addParticipant(battleId, userId, 0, "alive");
            BattleDao.addParticipant(battleId, opponentId, 0, "alive");

            BattleState state = new BattleState();
            state.battleId = battleId;
            state.userIds = Arrays.asList(userId, opponentId);
            state.hp = new HashMap<>();
            state.hp.put(userId, UserDao.getUserById(userId).currentHp);
            state.hp.put(opponentId, UserDao.getUserById(opponentId).currentHp);
            state.currentTurn = userId;
            state.status = "active";
            battleStates.put(battleId, state);

            return battleId;
        }

        public static void performAction(int battleId, int userId, int targetId) {
            BattleState state = battleStates.get(battleId);
            if (state == null || !state.status.equals("active")) return;
            if (state.currentTurn != userId) return;

            User attacker = UserDao.getUserById(userId);
            User target = UserDao.getUserById(targetId);

            int attackerDamage = 5;
            int targetArmor = 0;

            List<InventoryItem> attInv = InventoryDao.getInventory(userId);
            for (InventoryItem ii : attInv) {
                if (ii.equipped) {
                    Item item = ItemDao.getItemById(ii.itemId);
                    if (item.slot.startsWith("weapon")) {
                        attackerDamage += item.damage * (1 + ii.upgradeLevel);
                    }
                    if (item.slot.equals("head") || item.slot.equals("body") || item.slot.equals("legs") ||
                        item.slot.equals("arms") || item.slot.equals("boots") || item.slot.equals("gloves") ||
                        item.slot.equals("neck")) {
                        targetArmor += item.armor * (1 + ii.upgradeLevel);
                    }
                }
            }
            List<InventoryItem> targetInv = InventoryDao.getInventory(targetId);
            for (InventoryItem ii : targetInv) {
                if (ii.equipped) {
                    Item item = ItemDao.getItemById(ii.itemId);
                    if (item.slot.equals("head") || item.slot.equals("body") || item.slot.equals("legs") ||
                        item.slot.equals("arms") || item.slot.equals("boots") || item.slot.equals("gloves") ||
                        item.slot.equals("neck")) {
                        targetArmor += item.armor * (1 + ii.upgradeLevel);
                    }
                }
            }

            int damage = Math.max(1, attackerDamage - targetArmor / 2 + (int)(Math.random() * 10));
            int newHp = state.hp.get(targetId) - damage;
            if (newHp < 0) newHp = 0;
            state.hp.put(targetId, newHp);
            target.currentHp = newHp;
            UserDao.updateUser(target);

            if (newHp <= 0) {
                List<InventoryItem> equipped = InventoryDao.getEquippedItems(targetId);
                for (InventoryItem ii : equipped) {
                    InventoryDao.addItem(userId, ii.itemId, ii.upgradeLevel);
                    InventoryDao.deleteItem(ii.id);
                }
                attacker.coins += 10;
                attacker.exp += 50;
                while (attacker.exp >= 100) {
                    attacker.exp -= 100;
                    attacker.level += 1;
                    attacker.maxHp += 10;
                    attacker.currentHp = attacker.maxHp;
                }
                UserDao.updateUser(attacker);

                state.status = "finished";
                BattleDao.updateBattleStatus(battleId, "finished");
                BattleDao.updateParticipantStatus(battleId, targetId, "dead");
                BattleDao.updateParticipantStatus(battleId, userId, "alive");
                battleStates.put(battleId, state);
            } else {
                List<Integer> participants = BattleDao.getParticipants(battleId);
                for (int uid : participants) {
                    if (uid != userId && state.hp.getOrDefault(uid, 0) > 0) {
                        state.currentTurn = uid;
                        break;
                    }
                }
                battleStates.put(battleId, state);
            }
        }

        public static Object getBattleStatus(int battleId) {
            BattleState state = battleStates.get(battleId);
            if (state == null) return null;
            Map<String, Object> status = new HashMap<>();
            status.put("battleId", battleId);
            status.put("status", state.status);
            status.put("currentTurn", state.currentTurn);
            status.put("hp", state.hp);
            return status;
        }
    }

    public static class TopService {
        private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

        public static void startHourlyReward() {
            scheduler.scheduleAtFixedRate(() -> {
                List<User> top = UserDao.getTopPlayers(10);
                for (User user : top) {
                    int randomItemId = (int)(Math.random() * 5) + 1; // подгоните под количество ваших предметов
                    InventoryDao.addItem(user.id, randomItemId, 0);
                    System.out.println("Награда выдана игроку " + user.nickname);
                }
            }, 0, 1, TimeUnit.HOURS);
        }
    }

    // ========== ГЛАВНЫЙ МЕТОД ==========

    public static void main(String[] args) {
        port(getPort());

        initDatabase();
        loadItemsFromJson();
        TopService.startHourlyReward();

        staticFiles.location("/public");

        ObjectMapper mapper = new ObjectMapper();

        // Регистрация
        post("/api/register", (req, res) -> {
            User user = mapper.readValue(req.body(), User.class);
            if (UserDao.register(user)) {
                res.status(200);
                return "OK";
            } else {
                res.status(400);
                return "User exists";
            }
        });

        // Логин
        post("/api/login", (req, res) -> {
            User user = mapper.readValue(req.body(), User.class);
            User found = UserDao.login(user.nickname, user.password);
            if (found != null) {
                req.session(true).attribute("user", found);
                res.status(200);
                return mapper.writeValueAsString(found);
            } else {
                res.status(401);
                return "Invalid credentials";
            }
        });

        // Логаут
        post("/api/logout", (req, res) -> {
            req.session().removeAttribute("user");
            return "OK";
        });

        // Профиль
        get("/api/profile", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            User fresh = UserDao.getUserById(user.id);
            return mapper.writeValueAsString(fresh);
        });

        // Инвентарь
        get("/api/inventory", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            return mapper.writeValueAsString(GameService.getFullInventory(user.id));
        });

        // Экипировка
        post("/api/equip", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int invId = Integer.parseInt(req.queryParams("invId"));
            GameService.equipItem(user.id, invId);
            return "OK";
        });

        // Апгрейд
        post("/api/upgrade", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int invId = Integer.parseInt(req.queryParams("invId"));
            int chance = Integer.parseInt(req.queryParams("chance"));
            boolean success = GameService.upgradeItem(user.id, invId, chance);
            return success ? "Success" : "Failed";
        });

        // Создать бой
        post("/api/battle/create", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int opponentId = Integer.parseInt(req.queryParams("opponentId"));
            int battleId = GameService.createBattle(user.id, opponentId);
            return "" + battleId;
        });

        // Ход
        post("/api/battle/action", (req, res) -> {
            User user = req.session().attribute("user");
            if (user == null) { res.status(401); return "Unauthorized"; }
            int battleId = Integer.parseInt(req.queryParams("battleId"));
            int targetId = Integer.parseInt(req.queryParams("targetId"));
            GameService.performAction(battleId, user.id, targetId);
            return "OK";
        });

        // Статус боя
        get("/api/battle/status/:battleId", (req, res) -> {
            int battleId = Integer.parseInt(req.params("battleId"));
            Object status = GameService.getBattleStatus(battleId);
            if (status == null) { res.status(404); return "Not found"; }
            return mapper.writeValueAsString(status);
        });

        // Топ
        get("/api/top", (req, res) -> {
            return mapper.writeValueAsString(UserDao.getTopPlayers(10));
        });

        System.out.println("Сервер запущен на порту " + port());
    }

    private static int getPort() {
        String port = System.getenv("PORT");
        return port != null ? Integer.parseInt(port) : 4567;
    }
}