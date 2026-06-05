<?php
session_start();
require_once '../config/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$cook_id = $_SESSION['user_id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

$action = $_GET['action'] ?? null;
$id = $_GET['id'] ?? null;

switch ($action) {

    // GET — Φέρε όλα τα αιτήματα για τις αγγελίες του μάγειρα
    case 'mine':
        $stmt = $pdo->prepare("
            SELECT r.*, l.title as listing_title, l.portions_available,
                   u.name as consumer_name
            FROM requests r
            JOIN listings l ON r.listing_id = l.id
            JOIN users u ON r.consumer_id = u.id
            WHERE l.cook_id = ?
            ORDER BY r.created_at DESC
        ");
        $stmt->execute([$cook_id]);
        echo json_encode($stmt->fetchAll());
        break;

    // POST — Approve αίτημα
    case 'approve':
        // Βρες το listing_id για να μειώσεις τις μερίδες
        $stmt = $pdo->prepare("SELECT listing_id FROM requests WHERE id = ?");
        $stmt->execute([$id]);
        $request = $stmt->fetch();

        // Μείωσε τις διαθέσιμες μερίδες
        $stmt = $pdo->prepare("
            UPDATE listings 
            SET portions_available = portions_available - 1,
                status = CASE WHEN portions_available - 1 = 0 THEN 'inactive' ELSE status END
            WHERE id = ? AND portions_available > 0
        ");
        $stmt->execute([$request['listing_id']]);

        // Ενημέρωσε το status του αιτήματος
        $stmt = $pdo->prepare("UPDATE requests SET status='approved' WHERE id=?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        break;

    // POST — Reject αίτημα
    case 'reject':
        $stmt = $pdo->prepare("UPDATE requests SET status='rejected' WHERE id=?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        break;

    // POST — Σήμανση επιτυχούς παραλαβής
    case 'pickup':
        $stmt = $pdo->prepare("UPDATE requests SET status='pickedup' WHERE id=?");
        $stmt->execute([$id]);

        // Δώσε πόντο στον μάγειρα
        $stmt = $pdo->prepare("
            UPDATE users SET points = points + 1 
            WHERE id = ?
        ");
        $stmt->execute([$cook_id]);
        echo json_encode(['success' => true]);
        break;

    // POST — No-show: αφαίρεσε πόντο από τον καταναλωτή
    case 'noshow':
        // Βρες τον consumer
        $stmt = $pdo->prepare("SELECT consumer_id FROM requests WHERE id=?");
        $stmt->execute([$id]);
        $request = $stmt->fetch();

        // Αφαίρεσε πόντο
        $stmt = $pdo->prepare("
            UPDATE users SET points = points - 1 
            WHERE id = ?
        ");
        $stmt->execute([$request['consumer_id']]);

        // Ενημέρωσε status
        $stmt = $pdo->prepare("UPDATE requests SET status='noshow' WHERE id=?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}
?>