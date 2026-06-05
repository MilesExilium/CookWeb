<?php
session_start();
require_once '../config/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Προσωρινά για testing — αργότερα θα έρχεται από session
$cook_id = $_SESSION['user_id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Παίρνουμε το id από το URL αν υπάρχει (?id=5)
$id = $_GET['id'] ?? null;

switch ($method) {

    // GET — Φέρε τις αγγελίες του μάγειρα
    case 'GET':
        $stmt = $pdo->prepare("
            SELECT * FROM listings 
            WHERE cook_id = ? 
            AND status != 'expired'
            ORDER BY created_at DESC
        ");
        $stmt->execute([$cook_id]);
        echo json_encode($stmt->fetchAll());
        break;

    // POST — Δημιουργία νέας αγγελίας
    case 'POST':
        $stmt = $pdo->prepare("
            INSERT INTO listings 
            (cook_id, title, notes, photo, allergens, portions, portions_available, pickup_location, pickup_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $cook_id,
            $input['title'],
            $input['notes'] ?? null,
            $input['photo'] ?? null,
            json_encode($input['allergens'] ?? []),
            $input['portions'],
            $input['portions'],
            $input['pickup_location'],
            $input['pickup_time']
        ]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        break;

    // PUT — Επεξεργασία αγγελίας
    case 'PUT':
        $stmt = $pdo->prepare("
            UPDATE listings 
            SET title=?, notes=?, allergens=?, portions_available=?, pickup_location=?, pickup_time=?
            WHERE id=? AND cook_id=?
        ");
        $stmt->execute([
            $input['title'],
            $input['notes'] ?? null,
            json_encode($input['allergens'] ?? []),
            $input['portions_available'],
            $input['pickup_location'],
            $input['pickup_time'],
            $id,
            $cook_id
        ]);
        echo json_encode(['success' => true]);
        break;

    // DELETE — Διαγραφή αγγελίας
    case 'DELETE':
        $stmt = $pdo->prepare("
            DELETE FROM listings 
            WHERE id=? AND cook_id=?
        ");
        $stmt->execute([$id, $cook_id]);
        echo json_encode(['success' => true]);
        break;
}
?>