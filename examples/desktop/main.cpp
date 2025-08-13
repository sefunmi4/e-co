#include <QApplication>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QWidget>
#include <QObject>
#include <QUdpSocket>
#include <QNetworkDatagram>
#include <QCursor>
#include <QComboBox>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QGraphicsBlurEffect>
#include <QPainter>
#include <QKeyEvent>
#include <QMouseEvent>

#ifdef Q_OS_WIN
#include <windows.h>
#endif

// Desktop Qt demo with three independent layers (background, middle,
// foreground) and a control panel to select which layer is interactive.
// Non-active layers ignore mouse events so input falls through to the chosen
// window. Layer changes are broadcast over UDP so peers on the local network
// stay in sync. This version also demonstrates a glassy foreground overlay,
// z-ordered windows, and a simple procedural background module loaded from a
// JSON environment list.

struct Environment {
    QString name;
    QString background;
    QString module;
};

QVector<Environment> loadEnvironments() {
    QFile file("../../shared/environments.json");
    if (!file.open(QIODevice::ReadOnly)) return {};
    QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    QVector<Environment> envs;
    for (auto val : doc.array()) {
        QJsonObject obj = val.toObject();
        envs.append({obj.value("name").toString(), obj.value("background").toString(), obj.value("module").toString()});
    }
    return envs;
}

class LayeredWindow : public QWidget {
    Q_OBJECT
public:
    explicit LayeredWindow(const QString& title, QWidget* parent = nullptr) : QWidget(parent) {
        setWindowTitle(title);
        z = ++zCounter;
    }

protected:
    void mousePressEvent(QMouseEvent* e) override {
        bringToFront();
        QWidget::mousePressEvent(e);
    }

public slots:
    void bringToFront() {
        z = ++zCounter;
        raise();
        activateWindow();
    }

private:
    int z;
    static int zCounter;
};

int LayeredWindow::zCounter = 0;

class ProceduralBackground : public QWidget {
    Q_OBJECT
public:
    explicit ProceduralBackground(QWidget* parent = nullptr) : QWidget(parent) {
        setAttribute(Qt::WA_TranslucentBackground);
        setFocusPolicy(Qt::StrongFocus);
    }

protected:
    void paintEvent(QPaintEvent*) override {
        QPainter p(this);
        p.setRenderHint(QPainter::Antialiasing);
        p.fillRect(rect(), Qt::transparent);
        int size = 60;
        for (int x = -size * 2; x < width() + size * 2; x += size) {
            for (int y = -size * 2; y < height() + size * 2; y += size) {
                QPoint center(x + offset.x(), y + offset.y());
                QPolygon poly;
                poly << QPoint(center.x(), center.y() - size / 2)
                     << QPoint(center.x() + size / 2, center.y())
                     << QPoint(center.x(), center.y() + size / 2)
                     << QPoint(center.x() - size / 2, center.y());
                QColor c((x / size * 10) % 256, (y / size * 10) % 256, 200, 120);
                p.setBrush(c);
                p.setPen(Qt::NoPen);
                p.drawPolygon(poly);
            }
        }
    }

    void keyPressEvent(QKeyEvent* e) override {
        switch (e->key()) {
            case Qt::Key_Left:
                offset.rx() += 10;
                break;
            case Qt::Key_Right:
                offset.rx() -= 10;
                break;
            case Qt::Key_Up:
                offset.ry() += 10;
                break;
            case Qt::Key_Down:
                offset.ry() -= 10;
                break;
            default:
                QWidget::keyPressEvent(e);
                return;
        }
        update();
    }

private:
    QPoint offset{0, 0};
};

class NetworkStorage : public QObject {
    Q_OBJECT
public:
    NetworkStorage(QObject* parent = nullptr) : QObject(parent) {
        socket.bind(45454, QUdpSocket::ShareAddress);
        connect(&socket, &QUdpSocket::readyRead, this, &NetworkStorage::onReady);
    }

    void publish(const QString& layer) {
        socket.writeDatagram(layer.toUtf8(), QHostAddress::Broadcast, 45454);
    }

signals:
    void layerChanged(const QString& layer);

private slots:
    void onReady() {
        while (socket.hasPendingDatagrams()) {
            QNetworkDatagram d = socket.receiveDatagram();
            emit layerChanged(QString::fromUtf8(d.data()));
        }
    }

private:
    QUdpSocket socket;
};

// Very basic wallpaper setter placeholder.
void setWallpaper(const QString& path) {
#ifdef Q_OS_WIN
    SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, (void*)path.utf16(),
                          SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE);
#else
    Q_UNUSED(path);
    // TODO: implement for macOS and Linux using platform APIs.
#endif
}

// Example cursor control utility.
void moveCursor(int x, int y) {
    QCursor::setPos(x, y);
}

int main(int argc, char** argv) {
    QApplication app(argc, argv);

    NetworkStorage storage;
    auto environments = loadEnvironments();

    // Background layer which may host a procedural module.
    QWidget background;
    background.setWindowTitle("Background Layer");
    background.resize(800, 600);
    background.setWindowFlag(Qt::WindowStaysOnBottomHint);
    background.setAttribute(Qt::WA_TranslucentBackground);
    background.show();

    // Middle layer representing an application window.
    LayeredWindow middle("Middle Layer");
    middle.resize(400, 300);
    middle.move(200, 150);
    QLabel midLabel("Middleware App", &middle);
    QVBoxLayout midLayout;
    midLayout.addWidget(&midLabel);
    middle.setLayout(&midLayout);
    middle.show();

    // Foreground layer for gesture or cursor interaction with glass effect.
    QWidget foreground;
    foreground.setWindowTitle("Foreground Layer");
    foreground.resize(800, 600);
    foreground.setWindowFlag(Qt::FramelessWindowHint);
    foreground.setWindowFlag(Qt::Tool);
    foreground.setWindowFlag(Qt::WindowStaysOnTopHint);
    foreground.setAttribute(Qt::WA_TransparentForMouseEvents, true);
    foreground.setAttribute(Qt::WA_TranslucentBackground);
    foreground.setStyleSheet("background-color: rgba(255,255,255,40%);");
    QGraphicsBlurEffect* blur = new QGraphicsBlurEffect(&foreground);
    blur->setBlurRadius(20);
    foreground.setGraphicsEffect(blur);
    foreground.show();

    // Control panel with buttons and environment selector.
    QWidget panel;
    panel.setWindowTitle("Layer Control");
    QVBoxLayout panelLayout;
    QPushButton toBackground("Background");
    QPushButton toMiddle("Middle");
    QPushButton toForeground("Foreground");
    QComboBox envSelect;
    for (const auto& e : environments) envSelect.addItem(e.name);
    panelLayout.addWidget(&toBackground);
    panelLayout.addWidget(&toMiddle);
    panelLayout.addWidget(&toForeground);
    panelLayout.addWidget(&envSelect);
    panel.setLayout(&panelLayout);
    panel.show();

    ProceduralBackground* procedural = nullptr;

    auto applyEnvironment = [&](int index) {
        if (index < 0 || index >= environments.size()) return;
        const Environment& env = environments[index];
        if (procedural) {
            procedural->hide();
            procedural->deleteLater();
            procedural = nullptr;
        }
        if (!env.background.isEmpty()) {
            setWallpaper(env.background);
        }
        if (!env.module.isEmpty()) {
            procedural = new ProceduralBackground(&background);
            procedural->setGeometry(background.rect());
            procedural->show();
            procedural->setFocus();
        }
    };

    QObject::connect(&envSelect, &QComboBox::currentIndexChanged, applyEnvironment);
    applyEnvironment(envSelect.currentIndex());

    auto setActive = [&](QWidget* target, const QString& name) {
        background.setAttribute(Qt::WA_TransparentForMouseEvents, target != &background);
        middle.setAttribute(Qt::WA_TransparentForMouseEvents, target != &middle);
        foreground.setAttribute(Qt::WA_TransparentForMouseEvents, target != &foreground);
        target->raise();
        target->activateWindow();
        storage.publish(name);
        if (target == &foreground) {
            QApplication::setOverrideCursor(Qt::CrossCursor);
            moveCursor(foreground.width() / 2, foreground.height() / 2);
        } else {
            QApplication::restoreOverrideCursor();
        }
    };

    QObject::connect(&toBackground, &QPushButton::clicked, [&]() { setActive(&background, "background"); });
    QObject::connect(&toMiddle, &QPushButton::clicked, [&]() { setActive(&middle, "middle"); });
    QObject::connect(&toForeground, &QPushButton::clicked, [&]() { setActive(&foreground, "foreground"); });

    QObject::connect(&storage, &NetworkStorage::layerChanged, [&](const QString& layer) {
        if (layer == "background") setActive(&background, layer);
        else if (layer == "middle") setActive(&middle, layer);
        else if (layer == "foreground") setActive(&foreground, layer);
    });

    return app.exec();
}

#include "main.moc"

